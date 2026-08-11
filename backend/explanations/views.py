"""
explanations/views.py -- FR-04: AI Explanation (Gemini)
Checks the AIExplanation cache before calling the Gemini API.
"""
from django.shortcuts import get_object_or_404
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from questions.models import Question
from services.gemini_service import GEMINI_MODEL, GeminiServiceError, generate_explanation

from .models import AIExplanation
from .serializers import AIExplanationSerializer, ExplainRequestSerializer


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

        options = list(question.options.all())
        correct_option = next((option for option in options if option.is_correct), None)
        if correct_option is None:
            return Response(
                {"detail": "This question has no correct answer configured."},
                status=status.HTTP_422_UNPROCESSABLE_ENTITY,
            )

        try:
            explanation_text = generate_explanation(
                question.text,
                [option.text for option in options],
                correct_option.text,
            )
        except GeminiServiceError:
            return Response(
                {"detail": "The AI tutor is unavailable right now. Please try again shortly."},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        # get_or_create guards against a duplicate-key race if two requests
        # for the same (uncached) question land concurrently.
        explanation, _ = AIExplanation.objects.get_or_create(
            question=question,
            defaults={"explanation_text": explanation_text, "generated_by_model": GEMINI_MODEL},
        )

        return Response(AIExplanationSerializer(explanation).data)
