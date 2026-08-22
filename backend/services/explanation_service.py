"""
Groq integration layer for AI answer explanations (report Section 4.4,
Application layer). Abstracted as its own module so the AI provider can
be swapped without touching route/view code (NFR-06 Scalability).

Uses the same GROQ_API_KEY as services/question_generation_service.py
(RAG question generation) -- one AI provider and one key for the whole
app, instead of juggling separate systems/dashboards/quotas for each
feature.
"""
import os

from groq import Groq

# See question_generation_service.py's client for why the fallback
# dummy value matters: Groq's constructor raises immediately on a None
# api_key, which would otherwise crash Django app loading itself rather
# than failing gracefully at the point of an actual API call.
client = Groq(api_key=os.getenv("GROQ_API_KEY") or "not-configured")

EXPLANATION_MODEL = os.getenv("EXPLANATION_GROQ_MODEL", "openai/gpt-oss-20b")

# One retry absorbs transient hiccups (brief network blip, momentary rate
# limit) before the caller gives up and falls back to a canned explanation.
EXPLANATION_MAX_ATTEMPTS = 2


class ExplanationServiceError(Exception):
    """Raised when the Groq API call fails or returns no usable text
    after all retry attempts are exhausted."""


def _call_groq(prompt):
    last_error = None
    for _ in range(EXPLANATION_MAX_ATTEMPTS):
        try:
            response = client.chat.completions.create(
                model=EXPLANATION_MODEL,
                messages=[{"role": "user", "content": prompt}],
            )
        except Exception as exc:
            last_error = ExplanationServiceError(str(exc))
            continue

        explanation_text = (response.choices[0].message.content or "").strip()
        if explanation_text:
            return explanation_text
        last_error = ExplanationServiceError("Groq returned an empty response.")

    raise last_error


def generate_explanation(question_text, answer_details_block):
    """
    Build a prompt from the question + its answer details and call Groq.
    Returns Groq's raw text response verbatim -- the caller stores/shows
    it as-is rather than reshaping it, so what the learner sees is what
    the model actually wrote.

    answer_details_block is a pre-built plain-text description of the
    question's correct answer(s) -- and, where applicable, its other
    options/pairs -- shaped to the question's type by
    explanations.views._build_answer_context(). This function stays
    agnostic of question shape (MCQ vs fill-in-the-blank vs matching).

    Callers must check explanations.models.AIExplanation for a cached
    result before invoking this (T-08 DoS / quota countermeasure), and
    should fall back to build_fallback_explanation() if this raises.
    """
    prompt = (
        "You are an ISTQB CTFL v4.0 tutor helping a student understand a "
        "practice question they just answered.\n\n"
        f"Question: {question_text}\n\n"
        f"{answer_details_block}\n\n"
        "Write a clear, thorough explanation covering:\n"
        "1. Why the correct answer is right.\n"
        "2. If other options or pairs are listed above, briefly explain "
        "why each of the others is wrong (skip this step if there's "
        "nothing else listed to compare against).\n"
        "3. A short one-line summary or memory tip at the end.\n\n"
        "Use plain text only -- no markdown symbols like ** or #. Use "
        "short paragraphs and blank lines between sections so it stays "
        "easy to read. Do not repeat the question verbatim, and do not "
        "write phrases like 'ISTQB syllabus' or 'the syllabus says'."
    )

    return _call_groq(prompt)


def build_fallback_explanation(correct_summary):
    """
    Deterministic, non-AI explanation used when Groq is unavailable
    (quota exhausted, network failure, empty response) so the learner
    still gets useful feedback instead of a bare error (NFR-02).

    correct_summary is the short human-readable statement of the correct
    answer(s) built alongside the prompt block in
    explanations.views._build_answer_context().
    """
    return (
        f"The correct answer is: {correct_summary}. "
        "An AI-generated explanation isn't available right now -- please try again shortly for a full breakdown."
    )
