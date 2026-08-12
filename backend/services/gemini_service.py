"""
Google Gemini integration layer (report Section 4.4, Application layer).
Abstracted as its own module so the AI provider can be swapped without
touching route/view code (NFR-06 Scalability).
"""
import os
import google.generativeai as genai

genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")

# One retry absorbs transient hiccups (brief network blip, momentary rate
# limit) before the caller gives up and falls back to a canned explanation.
GEMINI_MAX_ATTEMPTS = 2


class GeminiServiceError(Exception):
    """Raised when the Gemini API call fails or returns no usable text
    after all retry attempts are exhausted."""


def _call_gemini(prompt):
    last_error = None
    for _ in range(GEMINI_MAX_ATTEMPTS):
        try:
            model = genai.GenerativeModel(GEMINI_MODEL)
            response = model.generate_content(prompt)
        except Exception as exc:
            last_error = GeminiServiceError(str(exc))
            continue

        explanation_text = (getattr(response, "text", "") or "").strip()
        if explanation_text:
            return explanation_text
        last_error = GeminiServiceError("Gemini returned an empty response.")

    raise last_error


def generate_explanation(question_text, options, correct_option_text):
    """
    Build a prompt from the question + options and call Gemini.
    Callers must check explanations.models.AIExplanation for a cached
    result before invoking this (T-08 DoS / quota countermeasure), and
    should fall back to build_fallback_explanation() if this raises.
    """
    options_block = "\n".join(f"- {option}" for option in options)
    prompt = (
        "You are an ISTQB CTFL v4.0 tutor helping a student understand a "
        "practice question they just answered.\n\n"
        f"Question: {question_text}\n\n"
        f"Answer options:\n{options_block}\n\n"
        f"Correct answer: {correct_option_text}\n\n"
        "In 2-4 concise sentences, explain why the correct answer is right "
        "and briefly why the other options are wrong. Do not repeat the "
        "question verbatim."
    )

    return _call_gemini(prompt)


def build_fallback_explanation(options, correct_option_text):
    """
    Deterministic, non-AI explanation used when Gemini is unavailable
    (quota exhausted, network failure, empty response) so the learner
    still gets useful feedback instead of a bare error (NFR-02).
    """
    incorrect_options = [option for option in options if option != correct_option_text]

    sentences = [f"The correct answer is: {correct_option_text}."]
    if incorrect_options:
        sentences.append(
            "The other option(s) (" + "; ".join(incorrect_options) + ") do not correctly answer this question."
        )
    sentences.append(
        "An AI-generated explanation isn't available right now -- please try again shortly for a more detailed breakdown."
    )
    return " ".join(sentences)
