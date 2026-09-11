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
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsAdminRole
from services.answer_reveal_service import build_reveal_payload
from services.analytics_service import record_attempt, revise_attempt_correctness
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
    QuestionImageSerializer,
    QuestionPublicSerializer,
)

DEFAULT_SESSION_SIZE = 10
MAX_SESSION_SIZE = 40

# ISTQB CTFL Foundation mock exam: a full paper is 40 questions with the
# official cognitive-level split below. The Mock Test mode draws these
# from the EXISTING question bank (read-only) -- never generated or
# hard-coded. Shorter self-tests scale the ratio proportionally.
MOCK_EXAM_SIZE = 40
CTFL_K_LEVEL_SPLIT = {"K1": 8, "K2": 24, "K3": 8}


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


def _round_robin_by_domain(pairs, want):
    """Pick up to `want` question ids from `pairs` -- a list of
    (question_id, domain_id) -- cycling through domains so the pick is
    spread across as many domains as possible before any one domain is
    drawn from a second time. Each domain's ids are consumed in random
    order."""
    if want <= 0 or not pairs:
        return []
    buckets = {}
    for question_id, domain_id in pairs:
        buckets.setdefault(domain_id, []).append(question_id)
    for ids in buckets.values():
        random.shuffle(ids)
    keys = list(buckets.keys())
    random.shuffle(keys)

    picked = []
    for key in itertools.cycle(keys):
        if len(picked) >= want or all(not buckets[k] for k in keys):
            break
        if buckets[key]:
            picked.append(buckets[key].pop())
    return picked


def _pick_istqb_mock_question_ids(count):
    """Select `count` question ids for an ISTQB CTFL mock exam, drawn
    ONLY from the existing question bank (read-only -- nothing generated,
    hard-coded, or duplicated).

    Eligibility: is_active=True AND question_type='mcq'. The whole bank
    is ISTQB CTFL v4.0 (see questions.models.Domain), so there is no
    separate certification/syllabus field to filter on and none is
    invented. The draw targets the official K1/K2/K3 cognitive-level
    split (8/24/8 for a 40-question paper) scaled to `count`, taking
    `cognitive_level` values exactly as stored -- never fabricating one.
    A level that can't be filled is back-filled from the other levels
    (and any untagged eligible MCQ). Within every level the pick is
    spread across domains and randomised, so consecutive mock exams get
    different, non-overlapping-by-luck question sets.

    Returns (selected_ids, diagnostics). `selected_ids` can be shorter
    than `count` when the bank simply doesn't hold enough eligible MCQ;
    the caller decides whether that is a hard failure.
    """
    pool = list(
        Question.objects.filter(
            is_active=True, question_type=Question.QuestionType.MCQ
        ).values_list("id", "cognitive_level", "domain_id")
    )

    by_level = {}
    for question_id, level, domain_id in pool:
        by_level.setdefault((level or "").upper(), []).append((question_id, domain_id))

    available_by_level = {lvl: len(items) for lvl, items in sorted(by_level.items())}

    # Scale the official 8/24/8 ratio to `count`, then hand any rounding
    # drift to K2 (the dominant bucket) so K1/K3 stay near their share
    # and the three targets still sum to exactly `count`.
    targets = {
        lvl: int(round(CTFL_K_LEVEL_SPLIT[lvl] / MOCK_EXAM_SIZE * count))
        for lvl in CTFL_K_LEVEL_SPLIT
    }
    targets["K2"] = max(0, targets["K2"] + (count - sum(targets.values())))

    selected = []
    used = set()
    shortfalls = {}
    for lvl in ("K1", "K2", "K3"):
        want = targets[lvl]
        picked = _round_robin_by_domain(by_level.get(lvl, []), want)
        selected.extend(picked)
        used.update(picked)
        if len(picked) < want:
            shortfalls[lvl] = want - len(picked)

    # Back-fill the remainder from every not-yet-used eligible MCQ,
    # regardless of K-level (covers a short bucket and any untagged rows).
    if len(selected) < count:
        leftover = [
            (question_id, domain_id)
            for items in by_level.values()
            for (question_id, domain_id) in items
            if question_id not in used
        ]
        backfill = _round_robin_by_domain(leftover, count - len(selected))
        selected.extend(backfill)

    random.shuffle(selected)
    selected = selected[:count]

    diagnostics = {
        "requested": count,
        "eligible_mcq_total": len(pool),
        "available_by_k_level": available_by_level,
        "k_level_targets": targets,
        "k_level_shortfalls": shortfalls,
        "selected": len(selected),
        "unique_ids": len(set(selected)),
    }
    return selected, diagnostics


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
            return Response(
                {"detail": "mode must be 'practice', 'test', or 'mock'."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # ISTQB Mock Test: a self-contained MCQ exam built to the official
        # CTFL cognitive-level split from the EXISTING bank. It ignores any
        # ?domains= filter (always all domains) and is validated before a
        # session is created, so an under-stocked bank never yields a
        # half-empty "40-question" paper.
        if mode == PracticeSession.Mode.MOCK:
            selected_ids, mock_diagnostic = _pick_istqb_mock_question_ids(count)
            if not selected_ids:
                return Response(
                    {
                        "detail": (
                            "Unable to create an ISTQB Mock Test: the question bank "
                            "has no active multiple-choice questions."
                        ),
                        "diagnostic": mock_diagnostic,
                    },
                    status=status.HTTP_422_UNPROCESSABLE_ENTITY,
                )
            if len(selected_ids) < count and count >= MOCK_EXAM_SIZE:
                return Response(
                    {
                        "detail": (
                            "Unable to create a complete ISTQB Mock Test because the "
                            "question bank currently contains fewer than 40 eligible "
                            "(active, multiple-choice) questions."
                        ),
                        "diagnostic": mock_diagnostic,
                    },
                    status=status.HTTP_422_UNPROCESSABLE_ENTITY,
                )
            mock_questions = list(
                Question.objects.filter(id__in=selected_ids)
                .select_related("domain")
                .prefetch_related("options", "blank_answers", "matching_pairs")
            )
            random.shuffle(mock_questions)
            session = PracticeSession.objects.create(
                user=request.user, question_count=len(mock_questions), mode=mode
            )
            data = QuestionPublicSerializer(
                mock_questions, many=True, context={"request": request}
            ).data
            return Response(
                {"session_id": session.id, "mode": session.mode, "questions": data}
            )

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
        data = QuestionPublicSerializer(questions, many=True, context={"request": request}).data
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

        # Session/attempt integrity (see SessionFinishView / DashboardView):
        # without these guards a client can replay submits for one question,
        # answer questions never served in the session, or keep submitting
        # after finishing -- each replay adds an Attempt row and (Test Mode)
        # a record_attempt() call, inflating PerformanceAnalytics and pushing
        # the finished session's score past question_count (dashboard then
        # reports >100% accuracy).
        if session.finished_at is not None:
            return Response(
                {"detail": "This session is already finished; no more answers can be submitted."},
                status=status.HTTP_409_CONFLICT,
            )
        # Re-submitting a question that already has an Attempt *edits* that
        # answer in place (the learner pressed "Change answer" before
        # finishing the exam). Only a genuinely new answer has to fit inside
        # the number of questions the session served.
        existing_attempt = Attempt.objects.filter(session=session, question=question).first()
        if existing_attempt is None and session.attempts.count() >= session.question_count:
            return Response(
                {"detail": "This session already has an answer for every question."},
                status=status.HTTP_409_CONFLICT,
            )

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

        if existing_attempt is not None:
            was_correct = existing_attempt.is_correct
            for field, value in attempt_fields.items():
                setattr(existing_attempt, field, value)
            existing_attempt.is_correct = is_correct
            existing_attempt.confidence = confidence
            existing_attempt.save()
            if selected_options is not None:
                existing_attempt.selected_options.set(selected_options)
            attempt = existing_attempt
            if session.mode == PracticeSession.Mode.TEST:
                # Keep the per-domain running total honest after an edit
                # (total_count unchanged, correct_count shifts by the delta).
                revise_attempt_correctness(
                    request.user, question.domain, was_correct, is_correct
                )
        else:
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
                # rehearsal, and the ISTQB Mock Test is a self-contained exam
                # -- both are deliberately kept out of the per-domain accuracy
                # aggregates.
                record_attempt(request.user, question.domain, is_correct)

        if session.mode in (PracticeSession.Mode.TEST, PracticeSession.Mode.MOCK):
            # Exam simulation (Real Exam and ISTQB Mock Test): don't leak
            # correctness or the answer key via the network response --
            # SessionReviewView reveals everything once the whole session
            # is finished.
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
            # Cap at question_count as defense-in-depth: AnswerSubmitView
            # already enforces one Attempt per (session, question) and no
            # more attempts than questions served, so this can only bite if
            # that guard regresses -- but a stored score > question_count
            # produces a >100% accuracy_percent on the dashboard.
            correct = session.attempts.filter(is_correct=True).count()
            session.score = min(correct, session.question_count)
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

        attempts_by_qid = {attempt.question_id: attempt for attempt in attempts}

        # The client passes the ordered question IDs it served this session
        # (?questions=3,7,12). Sessions don't persist that list, so without
        # it a *skipped* question -- one the learner navigated past without
        # answering -- is simply missing from the review. With it we return
        # an entry for every served question and flag the un-attempted ones
        # as skipped (they count as incorrect, exactly as the score treats
        # them). Omitting the param keeps the old answered-only response.
        served_ids = self._served_question_ids(
            request.query_params.get("questions"), list(attempts_by_qid), session
        )

        skipped_ids = [qid for qid in served_ids if qid not in attempts_by_qid]
        skipped_questions = {
            question.id: question
            for question in Question.objects.filter(id__in=skipped_ids)
            .select_related("domain")
            .prefetch_related("options", "blank_answers", "matching_pairs")
        }

        results = []
        for qid in served_ids:
            if len(results) >= session.question_count:
                break
            attempt = attempts_by_qid.get(qid)
            question = attempt.question if attempt is not None else skipped_questions.get(qid)
            if question is None:
                # An id in the client list that isn't a real question -- ignore it.
                continue
            results.append(self._review_entry(question, attempt, request))

        return Response(
            {
                "session_id": session.id,
                "question_count": session.question_count,
                "score": session.score,
                "mode": session.mode,
                "skipped_count": sum(1 for r in results if r["skipped"]),
                "results": results,
            }
        )

    # Bounds how many ids we'll parse out of ?questions= regardless of the
    # session size, so a malformed request can't make us do unbounded work.
    _MAX_SERVED_IDS = 500

    @classmethod
    def _served_question_ids(cls, raw, answered_ids, session):
        """Ordered question IDs to include in the review. Prefers the
        client-supplied list (?questions=), de-duplicated; falls back to just
        the answered questions when the param is absent (older clients),
        leaving the response unchanged. The session-size cap is applied later,
        to the resolved questions, so bogus ids don't crowd out real ones."""
        if raw:
            ordered = []
            seen = set()
            for chunk in raw.split(","):
                chunk = chunk.strip()
                if not chunk.isdigit():
                    continue
                qid = int(chunk)
                if qid not in seen:
                    seen.add(qid)
                    ordered.append(qid)
                if len(ordered) >= cls._MAX_SERVED_IDS:
                    break
            if ordered:
                return ordered
        return list(answered_ids)

    @staticmethod
    def _review_entry(question, attempt, request=None):
        """One review row. `attempt` is None for a skipped question, which
        reads as incorrect with an empty answer but still reveals the key."""
        qtype = question.question_type
        image_url = None
        if question.image:
            image_url = (
                request.build_absolute_uri(question.image.url)
                if request is not None
                else question.image.url
            )

        your_answer = {}
        if attempt is not None:
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

        confidence = attempt.confidence if attempt is not None else None
        is_correct = bool(attempt.is_correct) if attempt is not None else False

        return {
            "question_id": question.id,
            "domain": DomainSerializer(question.domain).data,
            "text": question.text,
            "image": image_url,
            "question_type": qtype,
            "difficulty": question.difficulty,
            "options": [{"id": opt.id, "text": opt.text} for opt in question.options.all()],
            "matching_pairs": [
                {"id": pair.id, "prompt_text": pair.prompt_text}
                for pair in question.matching_pairs.all()
            ],
            "is_correct": is_correct,
            "skipped": attempt is None,
            "your_answer": your_answer,
            # Confidence diagnostics -- see questions.constants.
            "confidence": confidence,
            "confidence_label": confidence_label(confidence),
            "high_confidence_mistake": is_high_confidence_mistake(confidence, is_correct),
            "low_confidence_correct": is_low_confidence_correct(confidence, is_correct),
            **build_reveal_payload(question),
        }


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
        .order_by("-created_at", "-id")
    )
    serializer_class = QuestionAdminSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        domain_id = self.request.query_params.get("domain")
        if domain_id:
            # A non-integer ?domain= would otherwise reach the ORM and raise
            # ValueError (sqlite) / DataError (PostgreSQL) -> HTTP 500.
            try:
                queryset = queryset.filter(domain_id=int(domain_id))
            except (TypeError, ValueError):
                queryset = queryset.none()
        return queryset

    @action(
        detail=True,
        methods=["post", "delete"],
        url_path="image",
        parser_classes=[MultiPartParser, FormParser],
    )
    def image(self, request, pk=None):
        """FR-06: attach or remove the question's diagram/screenshot.

        POST  multipart with field `image` -> stores it (replacing any
              existing file) and returns the updated question.
        DELETE -> clears the image and returns the updated question.
        """
        question = self.get_object()

        if request.method == "DELETE":
            if question.image:
                question.image.delete(save=True)
            return Response(self.get_serializer(question).data)

        serializer = QuestionImageSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        # Drop the previous file rather than orphaning it in MEDIA_ROOT.
        question.image.delete(save=False)
        question.image = serializer.validated_data["image"]
        question.save(update_fields=["image"])
        return Response(self.get_serializer(question).data)

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
