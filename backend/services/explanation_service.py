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
PROMPT_VERSION = "tutor-v1"


class ExplanationServiceError(Exception):
    """Raised when the Groq API call fails or returns no usable text
    after all retry attempts are exhausted."""


SYSTEM_PROMPT = (
    "You are an expert ISTQB (CTFL v4.0) software testing tutor having a "
    "one-on-one conversation with a student who just answered a practice "
    "question. Your job is to help them genuinely understand *why* the "
    "correct answer is correct -- not just to state it.\n\n"
    "How to write:\n"
    "- Explain the reasoning the way a knowledgeable tutor would talk to a "
    "student. Never robotic filler like 'X is correct because X is "
    "correct.'\n"
    "- The correct answer(s) given to you are the source of truth -- "
    "explain them, never contradict, replace, or second-guess them. Never "
    "invent facts, examples, or terminology not supported by the question, "
    "the answer data, or established ISTQB concepts.\n"
    "- Cover the underlying testing concept being tested, not just the "
    "surface answer. Use a concrete example when one would genuinely help.\n"
    "- When other options/pairs are listed, explain why each one is wrong "
    "(or right, for multi-select) rather than just listing them -- unless "
    "that would be pure repetition for options that are wrong for the same "
    "obvious reason.\n"
    "- Point out distinctions between concepts that are easy to confuse, "
    "when relevant.\n"
    "- Choose whatever structure genuinely fits this specific question -- "
    "plain paragraphs, an option-by-option breakdown, a short closing "
    "takeaway -- instead of forcing every answer into the same template. A "
    "simple true/false question might only need two or three short "
    "paragraphs; a nuanced multi-select question may need you to address "
    "every option.\n"
    "- Match the length to what real understanding needs -- long enough to "
    "teach the concept, never padded just to look detailed, and never a "
    "single bare sentence unless the question is genuinely trivial.\n"
    "- Don't repeat the question text verbatim, and avoid meta-phrases "
    "like 'the ISTQB syllabus says' -- just explain the concept directly.\n\n"
    "Formatting: plain prose by default. Use **bold** for a key term or "
    "short label, '- ' for a bullet list, or '1. ' '2. ' for a numbered "
    "list, with a blank line between paragraphs/sections -- only when it "
    "genuinely improves clarity. Do not use markdown headers (#), tables, "
    "or code fences."
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
        "This is a multiple-choice question with one correct option. "
        "Identify the correct option, explain why it's correct and the "
        "ISTQB concept behind it, and explain why the other options are "
        "wrong when that adds understanding."
    ),
    "true_false": (
        "This is a true/false question. State plainly whether the "
        "statement is true or false, explain why, name the relevant ISTQB "
        "concept, and if it's false, mention what would need to change to "
        "make it true."
    ),
    "multi_select": (
        "This is a multiple-select question -- more than one option is "
        "correct. Go through every option: say plainly whether it should "
        "be selected, and explain why it's correct or incorrect. Group "
        "related correct options together if they share the same "
        "underlying concept, rather than repeating yourself. Don't just "
        "list the options -- explain each one. A short closing takeaway "
        "can help if it clarifies a distinction the student might miss."
    ),
    "fill_blank": (
        "This is a fill-in-the-blank question. Explain why the accepted "
        "answer fits the definition or statement, the ISTQB concept it "
        "tests, and -- if there are other plausible-sounding terms a "
        "student might confuse it with -- briefly explain why those "
        "wouldn't fit."
    ),
    "matching": (
        "This is a matching question. Go through each correct pair, "
        "explain why those two items belong together and the concept "
        "connecting them, and call out any pairs that are easy to mix up "
        "with each other."
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
