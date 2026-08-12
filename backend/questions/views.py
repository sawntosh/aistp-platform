"""
questions/views.py -- FR-02 (Question Delivery), FR-03 (Scoring),
FR-07 (weighted domain delivery), FR-06 (Admin CRUD + JSON import).
"""
import json

from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework import generics, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsAdminRole
from services.analytics_service import record_attempt
from services.scoring_service import score_answer

from .imports import import_questions, validate_rows
from .models import AnswerOption, Attempt, Domain, PracticeSession, Question
from .serializers import (
    AnswerSubmitSerializer,
    DomainSerializer,
    QuestionAdminSerializer,
    QuestionPublicSerializer,
)

DEFAULT_SESSION_SIZE = 10
MAX_SESSION_SIZE = 40


class QuestionListView(APIView):
    """FR-02: serve a session's worth of active questions and create the
    PracticeSession that subsequent AnswerSubmitView calls attach to.

    Weighted delivery towards the learner's weakest domains (FR-07) is
    intentionally not implemented here yet -- it depends on
    services.analytics_service.get_weakest_domains, which is still a stub.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        try:
            count = int(request.query_params.get("count", DEFAULT_SESSION_SIZE))
        except ValueError:
            return Response({"detail": "count must be an integer."}, status=status.HTTP_400_BAD_REQUEST)
        count = max(1, min(count, MAX_SESSION_SIZE))

        questions = list(
            Question.objects.filter(is_active=True).select_related("domain").prefetch_related("options")
            .order_by("?")[:count]
        )
        if not questions:
            return Response({"detail": "No active questions available."}, status=status.HTTP_404_NOT_FOUND)

        session = PracticeSession.objects.create(user=request.user, question_count=len(questions))
        data = QuestionPublicSerializer(questions, many=True).data
        return Response({"session_id": session.id, "questions": data})


class AnswerSubmitView(APIView):
    """FR-03: score the submitted answer, write an Attempt row, and
    update PerformanceAnalytics for the relevant domain."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = AnswerSubmitSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        session = get_object_or_404(PracticeSession, id=data["session_id"], user=request.user)
        question = get_object_or_404(Question, id=data["question_id"], is_active=True)
        selected_option = get_object_or_404(
            AnswerOption, id=data["selected_option_id"], question=question
        )

        is_correct = score_answer(selected_option)

        Attempt.objects.create(
            session=session,
            user=request.user,
            question=question,
            selected_option=selected_option,
            is_correct=is_correct,
        )
        record_attempt(request.user, question.domain, is_correct)

        correct_option = question.options.filter(is_correct=True).first()
        return Response(
            {
                "is_correct": is_correct,
                "correct_option_id": correct_option.id if correct_option else None,
                "correct_option_text": correct_option.text if correct_option else None,
            }
        )


class AdminQuestionViewSet(viewsets.ModelViewSet):
    """FR-06: admin-only CRUD on questions/answer options."""
    permission_classes = [permissions.IsAuthenticated, IsAdminRole]
    queryset = Question.objects.all().select_related("domain").prefetch_related("options")
    serializer_class = QuestionAdminSerializer

    @action(detail=False, methods=["post"], url_path="import", parser_classes=[MultiPartParser, JSONParser])
    def import_from_json(self, request):
        """Bulk-create questions from a JSON file upload (field name 'file')
        or a raw JSON array body -- see questions/imports.py for the row
        format. Validation is all-or-nothing: a bad row rejects the whole
        batch instead of partially importing it."""
        uploaded_file = request.FILES.get("file")
        if uploaded_file is not None:
            try:
                rows = json.loads(uploaded_file.read().decode("utf-8"))
            except (json.JSONDecodeError, UnicodeDecodeError):
                return Response({"detail": "Uploaded file is not valid JSON."}, status=status.HTTP_400_BAD_REQUEST)
        elif isinstance(request.data, list):
            rows = request.data
        else:
            return Response(
                {"detail": "Provide a JSON file under 'file' or a raw JSON array body."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        cleaned_rows, errors = validate_rows(rows)
        if errors:
            return Response({"errors": errors}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            summary = import_questions(cleaned_rows)
        return Response(summary, status=status.HTTP_201_CREATED)


class DomainListView(generics.ListAPIView):
    """Read-only domain list for populating admin question forms."""
    permission_classes = [permissions.IsAuthenticated]
    queryset = Domain.objects.all().order_by("name")
    serializer_class = DomainSerializer
