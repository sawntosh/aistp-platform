"""
explanations/views.py -- FR-04: AI Explanation (Groq)
Checks the AIExplanation cache before calling the Groq API.
"""
import json

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
        correct_options = [option for option in options if option.is_correct]
        if not correct_options:
            return Response(
                {"detail": "This question has no correct answer configured."},
                status=status.HTTP_422_UNPROCESSABLE_ENTITY,
            )

        try:
            explanation_payload = generate_explanation(
                question.text,
                [option.text for option in options],
                [option.text for option in correct_options],
            )
        except ExplanationServiceError:
            # Groq is down/rate-limited/returned malformed JSON: degrade to
            # a canned explanation instead of failing the request outright
            # (NFR-02 availability). Not cached, so the next request for
            # this question retries Groq rather than being stuck with
            # the fallback text forever.
            fallback_payload = build_fallback_explanation(
                [option.text for option in options],
                [option.text for option in correct_options],
            )
            return Response({"explanation": fallback_payload, "is_fallback": True})

        # get_or_create guards against a duplicate-key race if two requests
        # for the same (uncached) question land concurrently.
        explanation, _ = AIExplanation.objects.get_or_create(
            question=question,
            defaults={
                "explanation_text": json.dumps(explanation_payload),
                "generated_by_model": EXPLANATION_MODEL,
            },
        )

        return Response(AIExplanationSerializer(explanation).data)
