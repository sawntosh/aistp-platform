"""
questions/views.py -- FR-02 (Question Delivery), FR-03 (Scoring),
FR-07 (weighted domain delivery), FR-06 (Admin CRUD).
"""
import random

from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import permissions, status, viewsets
from rest_framework.response import Response
from rest_framework.views import APIView

from analytics.models import PerformanceAnalytics
from services.analytics_service import get_weakest_domains
from services.scoring_service import score_answer

from .models import AnswerOption, Attempt, PracticeSession, Question
from .serializers import QuestionSerializer

# FR-02: a session is 10, 20 or 40 questions long.
ALLOWED_SESSION_LENGTHS = (10, 20, 40)
DEFAULT_SESSION_LENGTH = 10

# FR-07: this share of the session is pulled from the learner's weakest
# domains; the rest is spread across all active questions for coverage.
WEAK_DOMAIN_SHARE = 0.6
WEAK_DOMAIN_LIMIT = 2


class QuestionListView(APIView):
    """FR-02/FR-07: serve a session's worth of questions, weighted
    towards the learner's weakest domains using analytics data."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        try:
            count = int(request.query_params.get("count", DEFAULT_SESSION_LENGTH))
        except (TypeError, ValueError):
            count = DEFAULT_SESSION_LENGTH
        if count not in ALLOWED_SESSION_LENGTHS:
            count = DEFAULT_SESSION_LENGTH

        base_qs = Question.objects.filter(is_active=True).select_related("domain").prefetch_related("options")

        weak_domains = get_weakest_domains(request.user, limit=WEAK_DOMAIN_LIMIT)
        weak_domain_ids = [domain.id for domain in weak_domains]

        weighted_questions = []
        if weak_domain_ids:
            weighted_quota = max(1, round(count * WEAK_DOMAIN_SHARE))
            weighted_questions = list(
                base_qs.filter(domain_id__in=weak_domain_ids).order_by("?")[:weighted_quota]
            )

        remaining = count - len(weighted_questions)
        general_questions = []
        if remaining > 0:
            exclude_ids = [q.id for q in weighted_questions]
            general_questions = list(
                base_qs.exclude(id__in=exclude_ids).order_by("?")[:remaining]
            )

        questions = weighted_questions + general_questions
        random.shuffle(questions)

        session = PracticeSession.objects.create(user=request.user, question_count=len(questions))

        return Response(
            {
                "session_id": session.id,
                "questions": QuestionSerializer(questions, many=True).data,
            }
        )


class AnswerSubmitView(APIView):
    """FR-03: score the submitted answer, write an Attempt row, and
    update PerformanceAnalytics for the relevant domain."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        session_id = request.data.get("session_id")
        question_id = request.data.get("question_id")
        option_id = request.data.get("option_id")

        if not (session_id and question_id and option_id):
            return Response(
                {"detail": "session_id, question_id and option_id are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        session = get_object_or_404(PracticeSession, id=session_id, user=request.user)
        question = get_object_or_404(Question, id=question_id)
        selected_option = get_object_or_404(AnswerOption, id=option_id, question=question)

        is_correct = score_answer(selected_option)

        Attempt.objects.create(
            session=session,
            user=request.user,
            question=question,
            selected_option=selected_option,
            is_correct=is_correct,
        )

        analytics, _ = PerformanceAnalytics.objects.get_or_create(
            user=request.user, domain=question.domain
        )
        analytics.total_count += 1
        if is_correct:
            analytics.correct_count += 1
        analytics.save(update_fields=["total_count", "correct_count", "last_updated"])

        if session.finished_at is None and session.attempts.count() >= session.question_count:
            session.finished_at = timezone.now()
            session.score = session.attempts.filter(is_correct=True).count()
            session.save(update_fields=["finished_at", "score"])

        correct_option = question.options.filter(is_correct=True).first()

        return Response(
            {
                "is_correct": is_correct,
                "correct_option_id": correct_option.id if correct_option else None,
                "correct_option_text": correct_option.text if correct_option else None,
            }
        )


class AdminQuestionViewSet(viewsets.ModelViewSet):
    """FR-06: admin-only CRUD on questions/answer options.
    TODO: add IsAdminRole permission class checking request.user.role.
    """
    permission_classes = [permissions.IsAuthenticated]  # replace with IsAdminRole
    queryset = None  # TODO: Question.objects.all()
    serializer_class = None  # TODO
