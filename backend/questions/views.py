"""
questions/views.py -- FR-02 (Question Delivery), FR-03 (Scoring),
FR-07 (weighted domain delivery), FR-06 (Admin CRUD + JSON import).
"""
import itertools
import json
import random
import threading

from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import generics, mixins, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsAdminRole
from services.analytics_service import record_attempt
from services.question_generation_service import run_generation
from services.scoring_service import score_answer

from .imports import import_questions, validate_rows
from .models import AnswerOption, Attempt, Domain, GenerationJob, PracticeSession, Question
from .serializers import (
    AnswerSubmitSerializer,
    DomainSerializer,
    GenerationJobCreateSerializer,
    GenerationJobSerializer,
    QuestionAdminSerializer,
    QuestionPublicSerializer,
)

DEFAULT_SESSION_SIZE = 10
MAX_SESSION_SIZE = 40


def _pick_stratified_question_ids(base_qs, count):
    """Choose `count` question ids from base_qs, spreading the draw
    across (domain, question_type) combinations round-robin before
    falling back to a plain random pick for any remainder.

    A plain `order_by('?')[:count]` is random on every call, but random
    alone doesn't guarantee variety -- an imbalanced bank (e.g. mostly
    mcq left over from older data, only a handful of matching/fill_blank
    questions) can hand back a same-feeling, same-domain, same-type
    session purely by chance. This guarantees every distinct (domain,
    type) combination present gets pulled from before any repeats."""
    buckets = {}
    for domain_id, qtype, question_id in base_qs.values_list("domain_id", "question_type", "id"):
        buckets.setdefault((domain_id, qtype), []).append(question_id)
    for ids in buckets.values():
        random.shuffle(ids)

    keys = list(buckets.keys())
    random.shuffle(keys)

    selected = []
    if keys:
        exhausted = set()
        for key in itertools.cycle(keys):
            if len(selected) >= count or len(exhausted) >= len(keys):
                break
            bucket = buckets[key]
            if not bucket:
                exhausted.add(key)
                continue
            selected.append(bucket.pop())

    if len(selected) < count:
        remaining_needed = count - len(selected)
        fallback_ids = base_qs.exclude(id__in=selected).order_by("?").values_list("id", flat=True)[:remaining_needed]
        selected.extend(fallback_ids)

    return selected


class QuestionListView(APIView):
    """FR-02: serve a session's worth of active questions and create the
    PracticeSession that subsequent AnswerSubmitView calls attach to.

    Weighted delivery towards the learner's weakest domains (FR-07) is
    intentionally not implemented here yet, though
    services.analytics_service.get_weakest_domains is now available for it.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        try:
            count = int(request.query_params.get("count", DEFAULT_SESSION_SIZE))
        except ValueError:
            return Response({"detail": "count must be an integer."}, status=status.HTTP_400_BAD_REQUEST)
        count = max(1, min(count, MAX_SESSION_SIZE))

        questions_qs = Question.objects.filter(is_active=True)

        domains_param = request.query_params.get("domains")
        if domains_param:
            try:
                domain_ids = [int(value) for value in domains_param.split(",") if value.strip()]
            except ValueError:
                return Response(
                    {"detail": "domains must be a comma-separated list of integer ids."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            questions_qs = questions_qs.filter(domain_id__in=domain_ids)

        selected_ids = _pick_stratified_question_ids(questions_qs, count)
        if not selected_ids:
            return Response({"detail": "No active questions available."}, status=status.HTTP_404_NOT_FOUND)

        questions = list(
            Question.objects.filter(id__in=selected_ids)
            .select_related("domain")
            .prefetch_related("options", "blank_answers", "matching_pairs")
        )
        random.shuffle(questions)

        session = PracticeSession.objects.create(user=request.user, question_count=len(questions))
        data = QuestionPublicSerializer(questions, many=True).data
        return Response({"session_id": session.id, "questions": data})


class AnswerSubmitView(APIView):
    """FR-03: score the submitted answer, write an Attempt row, and
    update PerformanceAnalytics for the relevant domain.

    The expected payload shape depends on the question's question_type
    -- see AnswerSubmitSerializer -- so this view pulls out the right
    field once it has loaded the question, builds a scoring_service
    submission dict, and records the matching Attempt field(s)."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = AnswerSubmitSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        session = get_object_or_404(PracticeSession, id=data["session_id"], user=request.user)
        question = get_object_or_404(
            Question.objects.prefetch_related("options", "blank_answers", "matching_pairs"),
            id=data["question_id"],
            is_active=True,
        )
        qtype = question.question_type

        submission = {}
        attempt_fields = {}
        selected_options = None

        if qtype in (Question.QuestionType.MCQ, Question.QuestionType.TRUE_FALSE):
            option_id = data.get("selected_option_id")
            if option_id is None:
                return Response({"detail": "selected_option_id is required for this question."}, status=status.HTTP_400_BAD_REQUEST)
            selected_option = get_object_or_404(AnswerOption, id=option_id, question=question)
            submission["selected_option"] = selected_option
            attempt_fields["selected_option"] = selected_option

        elif qtype == Question.QuestionType.MULTI_SELECT:
            option_ids = data.get("selected_option_ids") or []
            if not option_ids:
                return Response({"detail": "selected_option_ids is required for this question."}, status=status.HTTP_400_BAD_REQUEST)
            selected_options = list(AnswerOption.objects.filter(id__in=option_ids, question=question))
            if len(selected_options) != len(set(option_ids)):
                return Response(
                    {"detail": "One or more selected_option_ids are invalid for this question."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            submission["selected_options"] = selected_options

        elif qtype == Question.QuestionType.FILL_BLANK:
            text_answer = data.get("text_answer", "")
            if not text_answer.strip():
                return Response({"detail": "text_answer is required for this question."}, status=status.HTTP_400_BAD_REQUEST)
            submission["text_answer"] = text_answer
            attempt_fields["text_answer"] = text_answer

        elif qtype == Question.QuestionType.MATCHING:
            matching_response = data.get("matching_response")
            if not matching_response:
                return Response({"detail": "matching_response is required for this question."}, status=status.HTTP_400_BAD_REQUEST)
            submission["matching_response"] = matching_response
            attempt_fields["matching_response"] = matching_response

        is_correct = score_answer(question, submission)

        attempt = Attempt.objects.create(
            session=session,
            user=request.user,
            question=question,
            is_correct=is_correct,
            **attempt_fields,
        )
        if selected_options is not None:
            attempt.selected_options.set(selected_options)

        record_attempt(request.user, question.domain, is_correct)

        response_payload = {"is_correct": is_correct, "question_type": qtype}
        if qtype in (Question.QuestionType.MCQ, Question.QuestionType.TRUE_FALSE):
            correct_option = question.options.filter(is_correct=True).first()
            response_payload["correct_option_id"] = correct_option.id if correct_option else None
            response_payload["correct_option_text"] = correct_option.text if correct_option else None
        elif qtype == Question.QuestionType.MULTI_SELECT:
            correct_options = question.options.filter(is_correct=True)
            response_payload["correct_option_ids"] = [opt.id for opt in correct_options]
            response_payload["correct_option_texts"] = [opt.text for opt in correct_options]
        elif qtype == Question.QuestionType.FILL_BLANK:
            first_answer = question.blank_answers.first()
            response_payload["correct_answer"] = first_answer.answer_text if first_answer else None
        elif qtype == Question.QuestionType.MATCHING:
            response_payload["correct_pairing"] = {
                str(pair.id): pair.match_text for pair in question.matching_pairs.all()
            }

        return Response(response_payload)


class SessionFinishView(APIView):
    """Marks a PracticeSession as finished and records its final score --
    feeds the analytics dashboard's session history and streak. Idempotent:
    calling it again on an already-finished session just returns the
    existing result instead of re-scoring."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, session_id):
        session = get_object_or_404(PracticeSession, id=session_id, user=request.user)

        if session.finished_at is None:
            session.score = session.attempts.filter(is_correct=True).count()
            session.finished_at = timezone.now()
            session.save(update_fields=["score", "finished_at"])

        return Response(
            {
                "id": session.id,
                "finished_at": session.finished_at,
                "question_count": session.question_count,
                "score": session.score,
            }
        )


class AdminQuestionViewSet(viewsets.ModelViewSet):
    """FR-06: admin-only CRUD on questions/answer options."""
    permission_classes = [permissions.IsAuthenticated, IsAdminRole]
    queryset = Question.objects.all().select_related("domain").prefetch_related(
        "options", "blank_answers", "matching_pairs"
    )
    serializer_class = QuestionAdminSerializer

    @action(detail=False, methods=["post"], url_path="import", parser_classes=[MultiPartParser, JSONParser])
    def import_from_json(self, request):
        """Bulk-create questions from a JSON file upload (field name 'file')
        or a raw JSON array body -- see questions/imports.py for the row
        format. Validation is all-or-nothing: a bad row rejects the whole
        batch instead of partially importing it.

        A file upload may also include 'domain_id': when present, every
        row's "Domain" field is overridden with that domain's name before
        validation, so a single-domain export doesn't need a correct (or
        any) "Domain" value per row -- the admin picks it once instead."""
        uploaded_file = request.FILES.get("file")
        if uploaded_file is not None:
            try:
                rows = json.loads(uploaded_file.read().decode("utf-8"))
            except (json.JSONDecodeError, UnicodeDecodeError):
                return Response({"detail": "Uploaded file is not valid JSON."}, status=status.HTTP_400_BAD_REQUEST)

            domain_id = request.data.get("domain_id")
            if domain_id:
                domain = get_object_or_404(Domain, id=domain_id)
                if isinstance(rows, list):
                    for row in rows:
                        if isinstance(row, dict):
                            row["Domain"] = domain.name
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


class AdminGenerationJobViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    """Admin-only: upload a PDF/DOCX syllabus document to kick off RAG
    question generation (POST), then poll job status (GET list/detail).
    Generation itself runs on a background thread -- see
    services.question_generation_service.run_generation -- since this
    project has no Celery/task-queue infrastructure; the request returns
    as soon as the job row is created."""
    permission_classes = [permissions.IsAuthenticated, IsAdminRole]
    queryset = GenerationJob.objects.all().order_by("-created_at")
    parser_classes = [MultiPartParser]

    def get_serializer_class(self):
        if self.action == "create":
            return GenerationJobCreateSerializer
        return GenerationJobSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        job = GenerationJob.objects.create(
            created_by=request.user,
            source_file=data["file"],
            source_filename=data["file"].name,
            question_types=data["question_types"],
            domain_names=data["domains"],
            target_per_domain=data["target_per_domain"],
        )

        threading.Thread(target=run_generation, args=(job.id,), daemon=True).start()

        return Response(GenerationJobSerializer(job).data, status=status.HTTP_202_ACCEPTED)


class DomainListView(generics.ListAPIView):
    """Public domain list -- powers the practice setup screen (including
    guest preview, before login) and the admin question forms."""
    permission_classes = [permissions.AllowAny]
    queryset = Domain.objects.all().order_by("name")
    serializer_class = DomainSerializer
