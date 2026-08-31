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
PROMPT_VERSION = "tutor-v3-istqb"


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
    "The seven ISTQB CTFL v4.0 testing principles, by name, for reference "
    "when one is genuinely relevant: (1) Testing shows the presence of "
    "defects, not their absence; (2) Exhaustive testing is impossible; "
    "(3) Early testing saves time and money; (4) Defects cluster "
    "together; (5) Tests wear out (the pesticide paradox); (6) Testing is "
    "context dependent; (7) Absence-of-errors is a fallacy. Many "
    "questions are about a definition, a test technique, or a process "
    "activity instead -- do not attach a principle unless the question is "
    "clearly about one.\n\n"
    "Structure your response using EXACTLY these section headings, in "
    "this order, each starting with '## ':\n\n"
    "## Correct Answer\n"
    "One short line stating the correct answer plainly.\n\n"
    "## Why Is This Correct?\n"
    "Explain the reasoning in detail, in short paragraphs. Bold the key "
    "terms with **term**.\n\n"
    "## ISTQB Concept\n"
    "Name the specific ISTQB CTFL v4.0 concept this question tests -- one "
    "of the seven principles above if it genuinely applies, otherwise the "
    "relevant definition, test technique, or process activity. Explain "
    "that concept in your own words in 2-4 sentences and say how it "
    "applies to this question. Never force an unrelated principle, and "
    "never quote the syllabus or cite page numbers.\n\n"
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
    "Formatting: use '## ' for the seven section headings above (nothing "
    "else) and '### ' for the per-option subsections inside '## Why Are "
    "the Other Options Incorrect?', "
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

# Section-specific guidance. Sections are referred to by heading rather
# than number so inserting/reordering a heading in SYSTEM_PROMPT can't
# silently point this guidance at the wrong section.
QUESTION_TYPE_GUIDANCE = {
    "mcq": (
        "This is a multiple-choice question with one correct option. "
        "Under '## Why Are the Other Options Incorrect?', add one '### ' "
        "subsection per remaining option, using each option's exact text "
        "as the subsection heading."
    ),
    "true_false": (
        "This is a true/false question. In '## Correct Answer', state "
        "whether the statement is True or False. Under '## Why Are the "
        "Other Options Incorrect?', add one subsection explaining why the "
        "other value would be wrong (e.g. if the statement is True, "
        "explain why 'False' doesn't hold) -- and if the statement is "
        "False, also say what change would make it True."
    ),
    "multi_select": (
        "This is a multiple-select question -- more than one option is "
        "correct. In '## Correct Answer', list every correct option. In "
        "the explanation sections, you can group related correct options "
        "together if they share the same underlying concept, rather than "
        "repeating yourself. Under '## Why Are the Other Options "
        "Incorrect?', add one '### ' subsection per incorrect option only."
    ),
    "fill_blank": (
        "This is a fill-in-the-blank question -- there are no other "
        "options provided, only the accepted answer(s). Adapt '## Why Are "
        "the Other Options Incorrect?' to cover plausible-sounding terms "
        "a student might confuse with the answer, each as its own '### ' "
        "subsection; omit that section entirely if you can't think of a "
        "genuinely confusable term."
    ),
    "matching": (
        "This is a matching question. In '## Correct Answer', list every "
        "correct pair. In the explanation sections, explain the concept "
        "connecting the pairs. Under '## Why Are the Other Options "
        "Incorrect?', add a '### ' subsection for each pair that's easy "
        "to confuse with another, explaining the distinction -- omit that "
        "section if no pairs are commonly confused."
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


def generate_explanation(question_text, question_type, answer_details_block, concept_context=""):
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

    concept_context is an optional plain-text block naming the question's
    domain / syllabus topic / learning objective, built by
    explanations.views._build_concept_context(). It only helps ground the
    "## ISTQB Concept" section -- it never carries the correct answer,
    which stays in answer_details_block and is the sole source of truth.

    Callers must check explanations.models.AIExplanation for a cached
    result before invoking this (T-08 DoS / quota countermeasure), and
    should fall back to build_fallback_explanation() if this raises.
    """
    type_label = QUESTION_TYPE_LABELS.get(question_type, "Question")
    type_guidance = QUESTION_TYPE_GUIDANCE.get(question_type, "")
    concept_block = f"{concept_context}\n\n" if concept_context else ""

    user_prompt = (
        f"Question type: {type_label}\n\n"
        f"Question: {question_text}\n\n"
        f"{concept_block}"
        f"{answer_details_block}\n\n"
        f"{type_guidance}"
    )

    return _call_groq(SYSTEM_PROMPT, user_prompt)


# The section headings ExplainView requires a Groq response to contain
# before it will cache and serve it. A reply missing any of these (wrong
# format, prose only, truncated) is treated as malformed: the caller
# degrades to build_fallback_explanation() exactly as it would for an API
# error, and nothing is cached. Kept next to SYSTEM_PROMPT so the check
# and the instructions can't drift apart.
REQUIRED_SECTION_HEADINGS = (
    "## Correct Answer",
    "## Why Is This Correct",
    "## ISTQB Concept",
    "## Key Concept to Remember",
)


def _heading_key(line):
    """Normalize a line for heading comparison: lowercase, strip '?'/':'
    and collapse whitespace, so '## Why Is This Correct?' and
    '##  why is this correct' match."""
    return " ".join(line.lower().replace("?", "").replace(":", "").split())


def explanation_has_required_sections(text):
    """True only if every heading in REQUIRED_SECTION_HEADINGS appears as
    its own line in `text`. Used by ExplainView to reject a malformed
    Groq response before it is persisted or shown to the learner."""
    if not text or not text.strip():
        return False
    present = {_heading_key(line) for line in text.splitlines()}
    return all(_heading_key(heading) in present for heading in REQUIRED_SECTION_HEADINGS)


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
