"""
explanations/views.py -- FR-04: AI Explanation (Groq)
Checks the AIExplanation cache before calling the Groq API.
"""
import hashlib

from django.db import connection, transaction
from django.shortcuts import get_object_or_404
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from questions.models import Question
from services.explanation_service import (
    EXPLANATION_MODEL,
    PROMPT_VERSION,
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


def _context_hash(question, prompt_block):
    """Fingerprints everything that should invalidate a cached explanation:
    the prompt template version plus the question's own content. If an
    admin edits the question text/options/pairs, or the AI prompt itself
    changes (PROMPT_VERSION bump in explanation_service.py), the hash
    changes and the next request regenerates instead of serving stale
    cached text forever."""
    raw = "|".join([PROMPT_VERSION, question.question_type, question.text, prompt_block])
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


class ExplainView(APIView):
    """Rate-limited (T-08 countermeasure) -- throttle_scope='explain'."""
    permission_classes = [permissions.IsAuthenticated]
    throttle_scope = "explain"

    def post(self, request):
        request_serializer = ExplainRequestSerializer(data=request.data)
        request_serializer.is_valid(raise_exception=True)
        question_id = request_serializer.validated_data["question_id"]

        question = get_object_or_404(Question, pk=question_id, is_active=True)

        answer_context = _build_answer_context(question)
        if answer_context is None:
            return Response(
                {"detail": "This question has no correct answer configured."},
                status=status.HTTP_422_UNPROCESSABLE_ENTITY,
            )

        context_hash = _context_hash(question, answer_context["prompt_block"])

        cached = AIExplanation.objects.filter(question=question, context_hash=context_hash).first()
        if cached:
            return Response(AIExplanationSerializer(cached).data)

        # Cold or stale cache: serialize concurrent requests for the same
        # question behind a per-question Postgres advisory lock so a burst
        # of clicks on one uncached question doesn't fan out into several
        # duplicate Groq calls (T-08). No-ops on non-Postgres backends
        # (e.g. sqlite in some local setups) -- duplicate calls are still
        # possible there, just not prevented.
        with transaction.atomic():
            if connection.vendor == "postgresql":
                with connection.cursor() as cursor:
                    cursor.execute("SELECT pg_advisory_xact_lock(%s)", [question.id])

            # Re-check now that we (may) hold the lock -- another request
            # could have just filled the cache while we were waiting on it.
            cached = AIExplanation.objects.filter(question=question, context_hash=context_hash).first()
            if cached:
                return Response(AIExplanationSerializer(cached).data)

            try:
                explanation_text = generate_explanation(
                    question.text, question.question_type, answer_context["prompt_block"]
                )
            except ExplanationServiceError:
                # Groq is down/rate-limited/returned nothing: degrade to a
                # canned explanation instead of failing the request outright
                # (NFR-02 availability). Not cached, so the next request for
                # this question retries Groq rather than being stuck with
                # the fallback text forever.
                fallback_text = build_fallback_explanation(answer_context["correct_summary"])
                return Response({"explanation": fallback_text, "is_fallback": True})

            # update_or_create, not get_or_create: a stale row may already
            # exist for this question with an old context_hash -- overwrite
            # it rather than leaving it stuck on outdated content.
            explanation, _ = AIExplanation.objects.update_or_create(
                question=question,
                defaults={
                    "explanation_text": explanation_text,
                    "generated_by_model": EXPLANATION_MODEL,
                    "context_hash": context_hash,
                },
            )

        return Response(AIExplanationSerializer(explanation).data)
