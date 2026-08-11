"""
Google Gemini integration layer (report Section 4.4, Application layer).
Abstracted as its own module so the AI provider can be swapped without
touching route/view code (NFR-06 Scalability).
"""
import os
import google.generativeai as genai

genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")


class GeminiServiceError(Exception):
    """Raised when the Gemini API call fails or returns no usable text."""


def generate_explanation(question_text, options, correct_option_text):
    """
    Build a prompt from the question + options and call Gemini.
    Callers must check explanations.models.AIExplanation for a cached
    result before invoking this (T-08 DoS / quota countermeasure).
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

    try:
        model = genai.GenerativeModel(GEMINI_MODEL)
        response = model.generate_content(prompt)
    except Exception as exc:
        raise GeminiServiceError(str(exc)) from exc

    explanation_text = (getattr(response, "text", "") or "").strip()
    if not explanation_text:
        raise GeminiServiceError("Gemini returned an empty response.")

    return explanation_text
