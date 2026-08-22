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

# Bump this whenever SYSTEM_PROMPT, QUESTION_TYPE_GUIDANCE, or the shape of
# the user prompt below changes. explanations.views._context_hash folds
# this into every cache key, so a bump makes every previously cached
# AIExplanation row look stale and regenerate on next request -- no manual
# cache-clearing or migration needed to roll out a prompt change.
PROMPT_VERSION = "tutor-v2-structured"


class ExplanationServiceError(Exception):
    """Raised when the Groq API call fails or returns no usable text
    after all retry attempts are exhausted."""


SYSTEM_PROMPT = (
    "You are an expert ISTQB (CTFL v4.0) software testing tutor writing a "
    "detailed study explanation for a student who just answered a practice "
    "question. Be thorough -- never shorten the explanation into a brief "
    "summary or drop important detail for the sake of brevity. At the same "
    "time, make it easy to read: short paragraphs (roughly 2-4 sentences "
    "each), clear section headings, and bullets only where they genuinely "
    "help -- never one long wall of text.\n\n"
    "Ground everything in the answer data given to you -- the correct "
    "answer(s) provided are the source of truth, never contradict, "
    "replace, or second-guess them. Never invent facts, examples, or "
    "terminology not supported by the question, the answer data, or "
    "established ISTQB concepts. Never robotic filler like 'X is correct "
    "because X is correct' -- explain the reasoning the way a "
    "knowledgeable tutor would talk to a student. Don't repeat the "
    "question text verbatim, and avoid meta-phrases like 'the ISTQB "
    "syllabus says.'\n\n"
    "Structure your response using EXACTLY these section headings, in "
    "this order, each starting with '## ':\n\n"
    "## Correct Answer\n"
    "One short line stating the correct answer plainly.\n\n"
    "## Why Is This Correct?\n"
    "Explain the reasoning in detail, in short paragraphs. Bold the key "
    "terms with **term**.\n\n"
    "## What Does It Actually Mean?\n"
    "Explain the underlying concept step by step, in short paragraphs, "
    "using '- ' bullets where they aid a step-by-step or list-like point. "
    "Keep the full technical depth here -- do not compress this into a "
    "one-liner.\n\n"
    "## Why Are the Other Options Incorrect?\n"
    "For EACH other option/pair given in the context, add a subsection "
    "starting with '### ' followed by that option's exact text, then "
    "2-4 sentences of real explanation of why it's wrong -- never just "
    "'this is incorrect', explain the actual difference. Omit this whole "
    "section only if there is truly nothing else provided to compare "
    "against.\n\n"
    "## Key Concept to Remember\n"
    "State the broader relationship or principle connecting these "
    "concepts, so the student retains it beyond this one question.\n\n"
    "## Exam Tip\n"
    "Point out the specific keywords or phrasing in the question that "
    "should cue a student toward the correct answer on a real ISTQB "
    "exam.\n\n"
    "Formatting: use '## ' for the six section headings above (nothing "
    "else) and '### ' for the per-option subsections inside section 4, "
    "**bold** for key terms, *italic* for light emphasis, and '- ' "
    "bullets where they genuinely help. Do not use pipe tables or code "
    "fences."
)

QUESTION_TYPE_LABELS = {
    "mcq": "Multiple choice (one correct option)",
    "true_false": "True / False",
    "multi_select": "Multiple select (two or more correct options)",
    "fill_blank": "Fill in the blank",
    "matching": "Matching",
}

QUESTION_TYPE_GUIDANCE = {
    "mcq": (
        "This is a multiple-choice question with one correct option. In "
        "section 4, add one '### ' subsection per remaining option, using "
        "each option's exact text as the subsection heading."
    ),
    "true_false": (
        "This is a true/false question. In section 1, state whether the "
        "statement is True or False. In section 4, add one subsection "
        "explaining why the other value would be wrong (e.g. if the "
        "statement is True, explain why 'False' doesn't hold) -- and if "
        "the statement is False, also mention in section 4 or earlier "
        "what change would make it True."
    ),
    "multi_select": (
        "This is a multiple-select question -- more than one option is "
        "correct. In section 1, list every correct option. In sections "
        "2-3, you can group related correct options together if they "
        "share the same underlying concept, rather than repeating "
        "yourself. In section 4, add one '### ' subsection per incorrect "
        "option only."
    ),
    "fill_blank": (
        "This is a fill-in-the-blank question -- there are no other "
        "options provided, only the accepted answer(s). Adapt section 4 "
        "to cover plausible-sounding terms a student might confuse with "
        "the answer, each as its own '### ' subsection; omit section 4 "
        "entirely if you can't think of a genuinely confusable term."
    ),
    "matching": (
        "This is a matching question. In section 1, list every correct "
        "pair. In sections 2-3, explain the concept connecting the pairs. "
        "In section 4, add a '### ' subsection for each pair that's easy "
        "to confuse with another, explaining the distinction -- omit "
        "section 4 if no pairs are commonly confused."
    ),
}


def _call_groq(system_prompt, user_prompt):
    last_error = None
    for _ in range(EXPLANATION_MAX_ATTEMPTS):
        try:
            response = client.chat.completions.create(
                model=EXPLANATION_MODEL,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
            )
        except Exception as exc:
            last_error = ExplanationServiceError(str(exc))
            continue

        explanation_text = (response.choices[0].message.content or "").strip()
        if explanation_text:
            return explanation_text
        last_error = ExplanationServiceError("Groq returned an empty response.")

    raise last_error


def generate_explanation(question_text, question_type, answer_details_block):
    """
    Build a prompt from the question + its answer details and call Groq.
    Returns Groq's raw text response verbatim -- the caller stores/shows
    it as-is rather than reshaping it, so what the learner sees is what
    the tutor persona actually wrote.

    question_type is one of Question.QuestionType's string values (this
    module deliberately doesn't import the Question model -- it just needs
    the string to pick type-specific guidance).

    answer_details_block is a pre-built plain-text description of the
    question's correct answer(s) -- and, where applicable, its other
    options/pairs -- shaped to the question's type by
    explanations.views._build_answer_context().

    Callers must check explanations.models.AIExplanation for a cached
    result before invoking this (T-08 DoS / quota countermeasure), and
    should fall back to build_fallback_explanation() if this raises.
    """
    type_label = QUESTION_TYPE_LABELS.get(question_type, "Question")
    type_guidance = QUESTION_TYPE_GUIDANCE.get(question_type, "")

    user_prompt = (
        f"Question type: {type_label}\n\n"
        f"Question: {question_text}\n\n"
        f"{answer_details_block}\n\n"
        f"{type_guidance}"
    )

    return _call_groq(SYSTEM_PROMPT, user_prompt)


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
