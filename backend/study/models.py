"""
study/models.py -- Study Mode's own tables, deliberately separate from
questions.PracticeSession / questions.Attempt / analytics.PerformanceAnalytics.

This separation is the isolation mechanism: analytics_service and
DashboardView only ever read PracticeSession/Attempt/PerformanceAnalytics,
so nothing written here can contaminate Test Mode's scores, accuracy, or
session history -- there is no shared table or shared counter to leak
through.
"""
from django.conf import settings
from django.db import models

from questions.models import AnswerOption, Question, Topic


class StudyContent(models.Model):
    """The lesson reading for one Topic. `content` uses the same
    lightweight markdown convention as AI explanations (## headings,
    "- " bullets, **bold**/*italic*) so the frontend can reuse the same
    renderer -- see frontend/src/utils/richText.js."""
    topic = models.OneToOneField(Topic, on_delete=models.CASCADE, related_name="study_content")
    title = models.CharField(max_length=200)
    content = models.TextField()
    order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["order", "id"]

    def __str__(self):
        return f"Study content for {self.topic}"


class StudySession(models.Model):
    """One learner's pass through a Topic's reading + reinforcement
    questions. Never scored, never finished_at/score like PracticeSession
    -- `completed_at` just marks the learner reached the completion
    screen."""
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="study_sessions")
    topic = models.ForeignKey(Topic, on_delete=models.CASCADE, related_name="study_sessions")
    started_at = models.DateTimeField(auto_now_add=True)
    content_viewed_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"StudySession {self.id} - {self.user} - {self.topic}"


class StudyAttempt(models.Model):
    """A single reinforcement question answered within a StudySession.
    Mirrors questions.Attempt's submission-shape fields so the same
    per-question-type payloads apply, but intentionally is NOT that
    model: nothing here is ever passed to
    services.analytics_service.record_attempt or counted into
    PerformanceAnalytics. `is_correct` exists only to drive the
    immediate educational feedback shown to the learner."""
    session = models.ForeignKey(StudySession, on_delete=models.CASCADE, related_name="attempts")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="study_attempts")
    question = models.ForeignKey(Question, on_delete=models.CASCADE, related_name="study_attempts")
    selected_option = models.ForeignKey(AnswerOption, on_delete=models.CASCADE, null=True, blank=True)
    selected_options = models.ManyToManyField(AnswerOption, blank=True, related_name="study_multi_attempts")
    text_answer = models.CharField(max_length=255, blank=True, default="")
    matching_response = models.JSONField(blank=True, default=dict)
    is_correct = models.BooleanField()
    answered_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"StudyAttempt {self.id} - user {self.user_id} - {'correct' if self.is_correct else 'incorrect'}"


class StudyProgress(models.Model):
    """Per-(user, topic) learning status -- mirrors the shape of
    analytics.PerformanceAnalytics (one row per user/grouping) but is a
    completely separate table with learning-oriented fields (status),
    never accuracy/score fields, so it can never be read by Test Mode's
    analytics queries."""

    class Status(models.TextChoices):
        NOT_STARTED = "not_started", "Not started"
        IN_PROGRESS = "in_progress", "In progress"
        COMPLETED = "completed", "Completed"

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="study_progress")
    topic = models.ForeignKey(Topic, on_delete=models.CASCADE, related_name="progress_records")
    status = models.CharField(max_length=15, choices=Status.choices, default=Status.NOT_STARTED)
    content_viewed_at = models.DateTimeField(null=True, blank=True)
    questions_completed_at = models.DateTimeField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("user", "topic")

    def __str__(self):
        return f"{self.user} - {self.topic}: {self.status}"
