"""
questions/models.py
Domain, Question, AnswerOption, Attempt, PracticeSession
-- Report Section 4.7 (Database Design) / Figure 8 (ER Diagram)
"""
from django.conf import settings
from django.db import models


class Domain(models.Model):
    """One of the six ISTQB CTFL v4.0 knowledge domains."""
    name = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True)

    def __str__(self):
        return self.name


class Question(models.Model):
    class Difficulty(models.TextChoices):
        EASY = "easy", "Easy"
        MEDIUM = "medium", "Medium"
        HARD = "hard", "Hard"

    domain = models.ForeignKey(Domain, on_delete=models.CASCADE, related_name="questions")
    text = models.TextField()
    difficulty = models.CharField(max_length=10, choices=Difficulty.choices, default=Difficulty.MEDIUM)
    is_active = models.BooleanField(default=True)  # FR-06: admin can deactivate
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.text[:60]


class AnswerOption(models.Model):
    """Up to 4 options per question (FR-06); exactly one is correct."""
    question = models.ForeignKey(Question, on_delete=models.CASCADE, related_name="options")
    text = models.CharField(max_length=500)
    is_correct = models.BooleanField(default=False)

    def __str__(self):
        return f"{self.text[:40]} ({'correct' if self.is_correct else 'incorrect'})"


class PracticeSession(models.Model):
    """One quiz session a learner starts (10/20/40 questions)."""
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="sessions")
    started_at = models.DateTimeField(auto_now_add=True)
    finished_at = models.DateTimeField(null=True, blank=True)
    question_count = models.PositiveIntegerField()
    score = models.PositiveIntegerField(null=True, blank=True)

    def __str__(self):
        return f"Session {self.id} - {self.user}"


class Attempt(models.Model):
    """A single answered question within a practice session -- FR-03."""
    session = models.ForeignKey(PracticeSession, on_delete=models.CASCADE, related_name="attempts")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="attempts")
    question = models.ForeignKey(Question, on_delete=models.CASCADE, related_name="attempts")
    selected_option = models.ForeignKey(AnswerOption, on_delete=models.CASCADE)
    is_correct = models.BooleanField()
    answered_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Attempt {self.id} - user {self.user_id} - {'correct' if self.is_correct else 'incorrect'}"
