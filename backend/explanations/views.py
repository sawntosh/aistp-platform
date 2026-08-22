"""
explanations/views.py -- FR-04: AI Explanation (Groq)
Checks the AIExplanation cache before calling the Groq API.
"""
from django.shortcuts import get_object_or_404
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from questions.models import Question
from services.explanation_service import (
    EXPLANATION_MODEL,
    ExplanationServiceError,
    build_fallback_explanation,
    generate_explanation,
)

from .models import AIExplanation
from .serializers import AIExplanationSerializer, ExplainRequestSerializer


def _build_answer_context(question):
    """Describe a question's correct answer(s) for the Groq prompt and
    for the deterministic fallback, shaped to its question_type. Returns
    None if the question has nothing configured to explain.

    Returns {"prompt_block": str, "correct_summary": str}:
    - prompt_block: the options/pairs + correct-answer section of the
      Groq prompt.
    - correct_summary: a short human-readable statement of the correct
      answer(s), used by build_fallback_explanation() when Groq is down.
    """
    qtype = question.question_type

    if qtype in (
        Question.QuestionType.MCQ,
        Question.QuestionType.TRUE_FALSE,
        Question.QuestionType.MULTI_SELECT,
    ):
        options = list(question.options.all())
        correct = [option.text for option in options if option.is_correct]
        if not correct:
            return None
        options_block = "\n".join(f"- {option.text}" for option in options)
        return {
            "prompt_block": f"Answer options:\n{options_block}\n\nCorrect answer(s): {'; '.join(correct)}",
            "correct_summary": "; ".join(correct),
        }

    if qtype == Question.QuestionType.FILL_BLANK:
        answers = list(question.blank_answers.values_list("answer_text", flat=True))
        if not answers:
            return None
        return {
            "prompt_block": f"This is a fill-in-the-blank question. Accepted answer(s): {'; '.join(answers)}",
            "correct_summary": "; ".join(answers),
        }

    if qtype == Question.QuestionType.MATCHING:
        pairs = list(question.matching_pairs.all())
        if not pairs:
            return None
        pairs_block = "\n".join(f"- {pair.prompt_text} -> {pair.match_text}" for pair in pairs)
        return {
            "prompt_block": f"This is a matching question. Correct pairs:\n{pairs_block}",
            "correct_summary": "; ".join(f"{pair.prompt_text} -> {pair.match_text}" for pair in pairs),
        }

    return None


class ExplainView(APIView):
    """Rate-limited (T-08 countermeasure) -- throttle_scope='explain'."""
    permission_classes = [permissions.IsAuthenticated]
    throttle_scope = "explain"

    def post(self, request):
        request_serializer = ExplainRequestSerializer(data=request.data)
        request_serializer.is_valid(raise_exception=True)
        question_id = request_serializer.validated_data["question_id"]

        question = get_object_or_404(Question, pk=question_id, is_active=True)

        cached = AIExplanation.objects.filter(question=question).first()
        if cached:
            return Response(AIExplanationSerializer(cached).data)

        answer_context = _build_answer_context(question)
        if answer_context is None:
            return Response(
                {"detail": "This question has no correct answer configured."},
                status=status.HTTP_422_UNPROCESSABLE_ENTITY,
            )

        try:
            explanation_text = generate_explanation(question.text, answer_context["prompt_block"])
        except ExplanationServiceError:
            # Groq is down/rate-limited/returned nothing: degrade to a
            # canned explanation instead of failing the request outright
            # (NFR-02 availability). Not cached, so the next request for
            # this question retries Groq rather than being stuck with
            # the fallback text forever.
            fallback_text = build_fallback_explanation(answer_context["correct_summary"])
            return Response({"explanation": fallback_text, "is_fallback": True})

        # get_or_create guards against a duplicate-key race if two requests
        # for the same (uncached) question land concurrently.
        explanation, _ = AIExplanation.objects.get_or_create(
            question=question,
            defaults={"explanation_text": explanation_text, "generated_by_model": EXPLANATION_MODEL},
        )

        return Response(AIExplanationSerializer(explanation).data)
