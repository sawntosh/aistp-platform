"""
Google Gemini integration layer (report Section 4.4, Application layer).
Abstracted as its own module so the AI provider can be swapped without
touching route/view code (NFR-06 Scalability).
"""
import os
import google.generativeai as genai

genai.configure(api_key=os.getenv("GEMINI_API_KEY"))


def generate_explanation(question_text, options, correct_option_text):
    """
    Build a prompt from the question + options and call Gemini.
    Callers must check explanations.models.AIExplanation for a cached
    result before invoking this (T-08 DoS / quota countermeasure).
    """
    raise NotImplementedError
