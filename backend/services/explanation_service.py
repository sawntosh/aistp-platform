"""
Groq integration layer for AI answer explanations (report Section 4.4,
Application layer). Abstracted as its own module so the AI provider can
be swapped without touching route/view code (NFR-06 Scalability).

Uses the same GROQ_API_KEY as services/question_generation_service.py
(RAG question generation) -- one AI provider and one key for the whole
app, instead of juggling separate systems/dashboards/quotas for each
feature.
"""
import json
import os

from groq import Groq

# See question_generation_service.py's client for why the fallback
# dummy value matters: Groq's constructor raises immediately on a None
# api_key, which would otherwise crash Django app loading itself rather
# than failing gracefully at the point of an actual API call.
client = Groq(api_key=os.getenv("GROQ_API_KEY") or "not-configured")

EXPLANATION_MODEL = os.getenv("EXPLANATION_GROQ_MODEL", "openai/gpt-oss-20b")

# One retry absorbs transient hiccups (brief network blip, momentary rate
# limit, malformed JSON) before the caller gives up and falls back to a
# canned explanation.
EXPLANATION_MAX_ATTEMPTS = 2


class ExplanationServiceError(Exception):
    """Raised when the Groq API call fails, or returns no usable/parseable
    explanation after all retry attempts are exhausted."""


def _parse_explanation_payload(raw_text):
    """Validate the shape the frontend renders: a list of per-option
    verdicts plus a one-sentence summary. Raises ValueError/KeyError/
    TypeError on anything that doesn't match -- callers treat that the
    same as a failed API call and retry/fall back."""
    parsed = json.loads(raw_text)
    items = parsed["items"]
    if not isinstance(items, list) or not items:
        raise ValueError("'items' must be a non-empty list")
    for item in items:
        if not {"option", "correct", "reason"} <= item.keys():
            raise ValueError("explanation item missing required keys")
    parsed.setdefault("summary", "")
    return parsed


def _call_groq(prompt):
    last_error = None
    for _ in range(EXPLANATION_MAX_ATTEMPTS):
        try:
            response = client.chat.completions.create(
                model=EXPLANATION_MODEL,
                messages=[{"role": "user", "content": prompt}],
                response_format={"type": "json_object"},
            )
        except Exception as exc:
            last_error = ExplanationServiceError(str(exc))
            continue

        raw_text = (response.choices[0].message.content or "").strip()
        if not raw_text:
            last_error = ExplanationServiceError("Groq returned an empty response.")
            continue

        try:
            return _parse_explanation_payload(raw_text)
        except (json.JSONDecodeError, KeyError, TypeError, ValueError) as exc:
            last_error = ExplanationServiceError(f"Groq returned malformed explanation JSON: {exc}")

    raise last_error


def generate_explanation(question_text, options, correct_options):
    """
    Build a prompt from the question + options and call Groq. Returns a
    dict shaped {"items": [{"option", "correct", "reason"}, ...],
    "summary": str} so the frontend can render each option's verdict
    individually instead of one blended paragraph.

    correct_options is a list -- most question types have exactly one
    correct option, but multi_select questions can have several.

    Callers must check explanations.models.AIExplanation for a cached
    result before invoking this (T-08 DoS / quota countermeasure), and
    should fall back to build_fallback_explanation() if this raises.
    """
    options_block = "\n".join(f"- {option}" for option in options)
    correct_block = "; ".join(correct_options)
    prompt = (
        "You are an ISTQB CTFL v4.0 tutor helping a student understand a "
        "practice question they just answered.\n\n"
        f"Question: {question_text}\n\n"
        f"Answer options:\n{options_block}\n\n"
        f"Correct answer(s): {correct_block}\n\n"
        "Respond with ONLY a JSON object (no markdown, no code fences) in "
        "exactly this shape:\n"
        '{"items": [{"option": "<option text, copied verbatim>", '
        '"correct": true or false, "reason": "<plain one-sentence reason>"}, '
        '...], "summary": "<one sentence on why the correct answer is the '
        'best choice overall>"}\n\n'
        "Include exactly one item per answer option listed above, in the "
        "same order, with the option text copied verbatim. Write each "
        "reason as a natural, direct explanation of the testing concept "
        "involved -- do not write phrases like 'ISTQB syllabus', 'the "
        "syllabus says', or similar meta-references in the reason text."
    )

    return _call_groq(prompt)


def build_fallback_explanation(options, correct_options):
    """
    Deterministic, non-AI explanation used when Groq is unavailable
    (quota exhausted, network failure, malformed response) so the
    learner still gets useful feedback instead of a bare error (NFR-02).
    Same {"items", "summary"} shape as generate_explanation() -- lists
    every option's correctness since there's no model available to
    reason about *why*.
    """
    correct_set = set(correct_options)
    return {
        "items": [
            {"option": option, "correct": option in correct_set, "reason": ""}
            for option in options
        ],
        "summary": (
            "An AI-generated explanation isn't available right now -- please "
            "try again shortly for the reasoning behind each option."
        ),
    }
