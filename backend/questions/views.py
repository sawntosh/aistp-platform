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
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import generics, mixins, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsAdminRole
from services.answer_reveal_service import build_reveal_payload
from services.analytics_service import record_attempt
from services.question_generation_service import run_generation
from services.scoring_service import score_answer

from .constants import (
    confidence_label,
    is_high_confidence_mistake,
    is_low_confidence_correct,
)
from .imports import import_questions, validate_rows
from .models import AnswerOption, Attempt, Domain, GenerationJob, PracticeSession, Question
from .pagination import QuestionPagination
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

    @extend_schema(
        parameters=[
            OpenApiParameter("count", OpenApiTypes.INT, description="Questions to serve (1-40, default 10)."),
            OpenApiParameter("domains", OpenApiTypes.STR, description="Comma-separated domain ids to filter by."),
        ],
        responses=OpenApiTypes.OBJECT,
        summary="Start a practice session",
        description="Creates a PracticeSession and returns its id plus a stratified set of active questions.",
    )
    def get(self, request):
        try:
            count = int(request.query_params.get("count", DEFAULT_SESSION_SIZE))
        except ValueError:
            return Response({"detail": "count must be an integer."}, status=status.HTTP_400_BAD_REQUEST)
        count = max(1, min(count, MAX_SESSION_SIZE))

        mode = request.query_params.get("mode", PracticeSession.Mode.PRACTICE)
        if mode not in PracticeSession.Mode.values:
            return Response({"detail": "mode must be 'practice' or 'test'."}, status=status.HTTP_400_BAD_REQUEST)

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

        session = PracticeSession.objects.create(user=request.user, question_count=len(questions), mode=mode)
        data = QuestionPublicSerializer(questions, many=True).data
        return Response({"session_id": session.id, "mode": session.mode, "questions": data})


class AnswerSubmitView(APIView):
    """FR-03: score the submitted answer, write an Attempt row, and --
    for Test Mode sessions only -- update PerformanceAnalytics for the
    relevant domain. Practice Mode attempts are recorded as Attempt rows
    but deliberately left out of the analytics aggregates.

    The expected payload shape depends on the question's question_type
    -- see AnswerSubmitSerializer -- so this view pulls out the right
    field once it has loaded the question, builds a scoring_service
    submission dict, and records the matching Attempt field(s)."""
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(
        request=AnswerSubmitSerializer,
        responses=OpenApiTypes.OBJECT,
        summary="Submit an answer",
        description=(
            "Scores one answer and records an Attempt. Send session_id + question_id plus "
            "exactly one answer field for the question's type (selected_option_id, "
            "selected_option_ids, text_answer, or matching_response)."
        ),
    )
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

        # Test Mode requires a 1-5 confidence rating with every answer;
        # Practice Mode does not collect it. The serializer has already
        # range-checked any value that was sent (see AnswerSubmitSerializer).
        confidence = data.get("confidence")
        if session.mode == PracticeSession.Mode.TEST:
            if confidence is None:
                return Response(
                    {"detail": "confidence (1-5) is required for Test Mode answers."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        else:
            confidence = None

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
            confidence=confidence,
            **attempt_fields,
        )
        if selected_options is not None:
            attempt.selected_options.set(selected_options)

        if session.mode == PracticeSession.Mode.TEST:
            # Only Test Mode moves the learner's tracked performance
            # analytics (FR-05/FR-07). Practice Mode is low-stakes
            # rehearsal and is deliberately kept out of the per-domain
            # accuracy aggregates.
            record_attempt(request.user, question.domain, is_correct)

            # Exam simulation: don't leak correctness or the answer key via
            # the network response -- SessionReviewView reveals everything
            # once the whole session is finished.
            response_payload = {"question_type": qtype, "recorded": True}
        else:
            response_payload = {"is_correct": is_correct, "question_type": qtype, **build_reveal_payload(question)}

        return Response(response_payload)


class SessionFinishView(APIView):
    """Marks a PracticeSession as finished and records its final score --
    feeds the analytics dashboard's session history and streak. Idempotent:
    calling it again on an already-finished session just returns the
    existing result instead of re-scoring."""
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(
        request=None,
        responses=OpenApiTypes.OBJECT,
        summary="Finish a practice session",
        description="Marks the session finished and returns its final score. Idempotent.",
    )
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


class SessionReviewView(APIView):
    """Test Mode's end-of-session reveal: every answer the learner
    submitted during a finished session, alongside the correct answer,
    domain description, and resource links -- withheld during the
    session itself (see AnswerSubmitView) so Test Mode plays out like a
    real exam. Only available once the session has been finished, and
    only to the learner who owns it."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, session_id):
        session = get_object_or_404(
            PracticeSession, id=session_id, user=request.user, finished_at__isnull=False
        )
        attempts = (
            session.attempts.select_related("question__domain", "selected_option")
            .prefetch_related(
                "question__options",
                "question__blank_answers",
                "question__matching_pairs",
                "selected_options",
            )
            .order_by("answered_at")
        )

        results = []
        for attempt in attempts:
            question = attempt.question
            qtype = question.question_type

            your_answer = {}
            if qtype in (Question.QuestionType.MCQ, Question.QuestionType.TRUE_FALSE):
                your_answer["selected_option_id"] = attempt.selected_option_id
                your_answer["selected_option_text"] = (
                    attempt.selected_option.text if attempt.selected_option else None
                )
            elif qtype == Question.QuestionType.MULTI_SELECT:
                selected = list(attempt.selected_options.all())
                your_answer["selected_option_ids"] = [opt.id for opt in selected]
                your_answer["selected_option_texts"] = [opt.text for opt in selected]
            elif qtype == Question.QuestionType.FILL_BLANK:
                your_answer["text_answer"] = attempt.text_answer
            elif qtype == Question.QuestionType.MATCHING:
                your_answer["matching_response"] = attempt.matching_response

            results.append(
                {
                    "question_id": question.id,
                    "domain": DomainSerializer(question.domain).data,
                    "text": question.text,
                    "question_type": qtype,
                    "difficulty": question.difficulty,
                    "options": [{"id": opt.id, "text": opt.text} for opt in question.options.all()],
                    "matching_pairs": [
                        {"id": pair.id, "prompt_text": pair.prompt_text}
                        for pair in question.matching_pairs.all()
                    ],
                    "is_correct": attempt.is_correct,
                    "your_answer": your_answer,
                    # Confidence diagnostics -- see questions.constants.
                    "confidence": attempt.confidence,
                    "confidence_label": confidence_label(attempt.confidence),
                    "high_confidence_mistake": is_high_confidence_mistake(
                        attempt.confidence, attempt.is_correct
                    ),
                    "low_confidence_correct": is_low_confidence_correct(
                        attempt.confidence, attempt.is_correct
                    ),
                    **build_reveal_payload(question),
                }
            )

        return Response(
            {
                "session_id": session.id,
                "question_count": session.question_count,
                "score": session.score,
                "mode": session.mode,
                "results": results,
            }
        )


class AdminQuestionViewSet(viewsets.ModelViewSet):
    """FR-06: admin-only CRUD on questions/answer options.

    The list action is paginated (QuestionPagination) and accepts an
    optional ?domain=<id> filter so the admin table can page and filter
    across the whole bank instead of pulling every row at once.
    """
    permission_classes = [permissions.IsAuthenticated, IsAdminRole]
    pagination_class = QuestionPagination
    queryset = (
        Question.objects.all()
        .select_related("domain")
        .prefetch_related("options", "blank_answers", "matching_pairs")
        .order_by("-id")
    )
    serializer_class = QuestionAdminSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        domain_id = self.request.query_params.get("domain")
        if domain_id:
            queryset = queryset.filter(domain_id=domain_id)
        return queryset

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
