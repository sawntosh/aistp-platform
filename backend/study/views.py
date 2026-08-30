"""
study/views.py -- Study Mode's API. Every view here is intentionally
disconnected from questions.views' PracticeSession/Attempt machinery and
from services.analytics_service: Study Mode reads the Question/Domain/
Topic bank (reuse), but writes only to this app's own tables.
"""
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import permissions, serializers, status
from rest_framework.response import Response
from rest_framework.views import APIView

from questions.models import AnswerOption, Domain, Question, Topic
from questions.serializers import QuestionPublicSerializer
from services.answer_reveal_service import build_reveal_payload
from services.scoring_service import score_answer

from .models import StudyAttempt, StudyContent, StudyProgress, StudySession
from .serializers import StudyContentSerializer


class StudyAnswerSubmitSerializer(serializers.Serializer):
    """Same four answer shapes as questions.AnswerSubmitSerializer, minus
    session_id -- the session comes from the URL here."""
    question_id = serializers.IntegerField()
    selected_option_id = serializers.IntegerField(required=False)
    selected_option_ids = serializers.ListField(child=serializers.IntegerField(), required=False)
    # See questions.serializers.AnswerSubmitSerializer: cap at
    # StudyAttempt.text_answer's varchar(255) so an over-long answer is a
    # clean 400 rather than a PostgreSQL DataError / 500.
    text_answer = serializers.CharField(required=False, allow_blank=True, max_length=255)
    matching_response = serializers.DictField(child=serializers.CharField(max_length=255), required=False)


def _topic_progress_map(user, topics):
    records = StudyProgress.objects.filter(user=user, topic__in=topics)
    return {record.topic_id: record for record in records}


class StudyDomainListView(APIView):
    """GET /api/study/domains/ -- every domain, annotated with this
    learner's topic-completion counts. Read-only over Domain/Topic/
    StudyProgress; touches no Test Mode table."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        domains = Domain.objects.all().order_by("name")
        topics = Topic.objects.filter(domain__in=domains, is_active=True)
        progress_by_topic = _topic_progress_map(request.user, topics)

        topics_by_domain = {}
        for topic in topics:
            topics_by_domain.setdefault(topic.domain_id, []).append(topic)

        results = []
        for domain in domains:
            domain_topics = topics_by_domain.get(domain.id, [])
            completed = sum(
                1
                for t in domain_topics
                if progress_by_topic.get(t.id) and progress_by_topic[t.id].status == StudyProgress.Status.COMPLETED
            )
            in_progress = sum(
                1
                for t in domain_topics
                if progress_by_topic.get(t.id) and progress_by_topic[t.id].status == StudyProgress.Status.IN_PROGRESS
            )
            results.append(
                {
                    "id": domain.id,
                    "name": domain.name,
                    "description": domain.description,
                    "topic_count": len(domain_topics),
                    "completed_count": completed,
                    "in_progress_count": in_progress,
                }
            )
        return Response(results)


class StudyTopicListView(APIView):
    """GET /api/study/domains/<domain_id>/topics/ -- the topics inside
    one domain, each annotated with this learner's progress status,
    whether it has reading content yet, and how many reinforcement
    questions are tagged to it."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, domain_id):
        domain = get_object_or_404(Domain, id=domain_id)
        topics = Topic.objects.filter(domain=domain, is_active=True).order_by("order", "id")
        progress_by_topic = _topic_progress_map(request.user, topics)

        results = []
        for topic in topics:
            record = progress_by_topic.get(topic.id)
            results.append(
                {
                    "id": topic.id,
                    "title": topic.title,
                    "description": topic.description,
                    "order": topic.order,
                    "status": record.status if record else StudyProgress.Status.NOT_STARTED,
                    "has_content": StudyContent.objects.filter(topic=topic).exists(),
                    "question_count": Question.objects.filter(topic=topic, is_active=True).count(),
                }
            )
        return Response({"domain": {"id": domain.id, "name": domain.name}, "topics": results})


class StudyTopicStartView(APIView):
    """POST /api/study/topics/<topic_id>/start/ -- entry point for the
    content reader. Creates (or reuses an in-progress) StudySession,
    marks StudyProgress in_progress, and returns the reading content
    plus this topic's reinforcement questions in one round trip so the
    reader doesn't need a second call before the learner reaches the
    questions (see project-wide guidance against unnecessary API calls)."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, topic_id):
        topic = get_object_or_404(Topic, id=topic_id, is_active=True)

        session = (
            StudySession.objects.filter(user=request.user, topic=topic, completed_at__isnull=True)
            .order_by("-started_at")
            .first()
        )
        if session is None:
            session = StudySession.objects.create(user=request.user, topic=topic)

        now = timezone.now()
        if session.content_viewed_at is None:
            session.content_viewed_at = now
            session.save(update_fields=["content_viewed_at"])

        progress, _ = StudyProgress.objects.get_or_create(user=request.user, topic=topic)
        if progress.status == StudyProgress.Status.NOT_STARTED:
            progress.status = StudyProgress.Status.IN_PROGRESS
            progress.content_viewed_at = now
            progress.save(update_fields=["status", "content_viewed_at", "updated_at"])

        content = StudyContent.objects.filter(topic=topic).first()
        questions = list(
            Question.objects.filter(topic=topic, is_active=True)
            .select_related("domain")
            .prefetch_related("options", "blank_answers", "matching_pairs")
        )

        return Response(
            {
                "session_id": session.id,
                "topic": {"id": topic.id, "title": topic.title, "description": topic.description, "domain_id": topic.domain_id},
                "content": StudyContentSerializer(content).data if content else None,
                "questions": QuestionPublicSerializer(questions, many=True).data,
            }
        )


class StudyAnswerView(APIView):
    """POST /api/study/sessions/<session_id>/answer/ -- check one answer
    for immediate educational feedback. Deliberately mirrors
    questions.views.AnswerSubmitView's per-type payload handling, but
    every side effect stops at StudyAttempt: no Attempt row, no
    services.analytics_service.record_attempt call, no
    PerformanceAnalytics update. That is the whole isolation guarantee --
    this view structurally cannot touch a Test Mode metric."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, session_id):
        serializer = StudyAnswerSubmitSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        session = get_object_or_404(StudySession, id=session_id, user=request.user)
        question = get_object_or_404(
            Question.objects.prefetch_related("options", "blank_answers", "matching_pairs"),
            id=data["question_id"],
            is_active=True,
        )
        # A Study session is scoped to one topic (StudyTopicStartView only
        # ever serves that topic's tagged questions). Reject answers for any
        # other question so a StudyAttempt can't be recorded -- and the
        # reveal payload returned -- for an arbitrary bank question.
        if question.topic_id != session.topic_id:
            return Response(
                {"detail": "This question is not part of the topic being studied."},
                status=status.HTTP_400_BAD_REQUEST,
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

        # Deterministic check only -- same rule-based function Test Mode
        # uses, never AI. Its result feeds educational feedback, not a
        # score: no Attempt row, no record_attempt call below.
        is_correct = score_answer(question, submission)

        attempt = StudyAttempt.objects.create(
            session=session,
            user=request.user,
            question=question,
            is_correct=is_correct,
            **attempt_fields,
        )
        if selected_options is not None:
            attempt.selected_options.set(selected_options)

        return Response({"is_correct": is_correct, "question_type": qtype, **build_reveal_payload(question)})


class StudySessionCompleteView(APIView):
    """POST /api/study/sessions/<session_id>/complete/ -- marks the
    session and this topic's StudyProgress complete (never a score), and
    suggests the next topic in the same domain the learner hasn't
    finished yet."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, session_id):
        session = get_object_or_404(StudySession, id=session_id, user=request.user)
        now = timezone.now()

        if session.completed_at is None:
            session.completed_at = now
            session.save(update_fields=["completed_at"])

        progress, _ = StudyProgress.objects.get_or_create(user=request.user, topic=session.topic)
        progress.status = StudyProgress.Status.COMPLETED
        progress.questions_completed_at = now
        progress.save(update_fields=["status", "questions_completed_at", "updated_at"])

        questions_answered = session.attempts.count()

        completed_topic_ids = set(
            StudyProgress.objects.filter(
                user=request.user, status=StudyProgress.Status.COMPLETED
            ).values_list("topic_id", flat=True)
        )
        next_topic = (
            Topic.objects.filter(domain=session.topic.domain, is_active=True)
            .exclude(id__in=completed_topic_ids)
            .order_by("order", "id")
            .first()
        )

        return Response(
            {
                "session_id": session.id,
                "topic": {"id": session.topic.id, "title": session.topic.title, "domain_id": session.topic.domain_id},
                "questions_answered": questions_answered,
                "next_topic": (
                    {"id": next_topic.id, "title": next_topic.title, "domain_id": next_topic.domain_id}
                    if next_topic
                    else None
                ),
            }
        )
