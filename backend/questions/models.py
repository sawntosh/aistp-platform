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

    class QuestionType(models.TextChoices):
        MCQ = "mcq", "Multiple Choice"
        TRUE_FALSE = "true_false", "True / False"
        MULTI_SELECT = "multi_select", "Multiple Answer"
        FILL_BLANK = "fill_blank", "Fill in the Blank"
        MATCHING = "matching", "Matching"

    domain = models.ForeignKey(Domain, on_delete=models.CASCADE, related_name="questions")
    text = models.TextField()
    difficulty = models.CharField(max_length=10, choices=Difficulty.choices, default=Difficulty.MEDIUM)
    question_type = models.CharField(max_length=20, choices=QuestionType.choices, default=QuestionType.MCQ)
    # Optional syllabus metadata carried over from bulk JSON import; left blank
    # for questions entered by hand via the admin CRUD form.
    cognitive_level = models.CharField(max_length=10, blank=True, default="")
    learning_objective_id = models.CharField(max_length=20, blank=True, default="")
    learning_objective = models.CharField(max_length=255, blank=True, default="")
    source_section = models.CharField(max_length=255, blank=True, default="")
    is_active = models.BooleanField(default=True)  # FR-06: admin can deactivate
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.text[:60]


class AnswerOption(models.Model):
    """Up to 4 options per question (FR-06). Exactly one is correct for
    mcq/true_false; two or more are correct for multi_select."""
    question = models.ForeignKey(Question, on_delete=models.CASCADE, related_name="options")
    text = models.CharField(max_length=500)
    is_correct = models.BooleanField(default=False)

    def __str__(self):
        return f"{self.text[:40]} ({'correct' if self.is_correct else 'incorrect'})"


class FillBlankAnswer(models.Model):
    """One acceptable phrasing of the correct answer for a fill_blank
    question. Multiple rows let the grader accept synonyms/variants."""
    question = models.ForeignKey(Question, on_delete=models.CASCADE, related_name="blank_answers")
    answer_text = models.CharField(max_length=255)

    def __str__(self):
        return self.answer_text


class MatchingPair(models.Model):
    """One left/right pair for a matching question."""
    question = models.ForeignKey(Question, on_delete=models.CASCADE, related_name="matching_pairs")
    prompt_text = models.CharField(max_length=255)
    match_text = models.CharField(max_length=255)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["order", "id"]

    def __str__(self):
        return f"{self.prompt_text} -> {self.match_text}"


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
    """A single answered question within a practice session -- FR-03.

    Exactly one of the four submission fields below is populated,
    depending on question.question_type:
        mcq / true_false -> selected_option
        multi_select      -> selected_options
        fill_blank        -> text_answer
        matching          -> matching_response
    """
    session = models.ForeignKey(PracticeSession, on_delete=models.CASCADE, related_name="attempts")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="attempts")
    question = models.ForeignKey(Question, on_delete=models.CASCADE, related_name="attempts")
    selected_option = models.ForeignKey(AnswerOption, on_delete=models.CASCADE, null=True, blank=True)
    selected_options = models.ManyToManyField(AnswerOption, blank=True, related_name="multi_attempts")
    text_answer = models.CharField(max_length=255, blank=True, default="")
    matching_response = models.JSONField(blank=True, default=dict)
    is_correct = models.BooleanField()
    answered_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Attempt {self.id} - user {self.user_id} - {'correct' if self.is_correct else 'incorrect'}"


class GenerationJob(models.Model):
    """Tracks one admin-triggered RAG question-generation run from an
    uploaded PDF/DOCX syllabus document (backend/services/
    question_generation_service.py). Runs in a background thread; the
    admin UI polls this row for progress."""

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        PROCESSING = "processing", "Processing"
        COMPLETED = "completed", "Completed"
        FAILED = "failed", "Failed"

    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="generation_jobs")
    source_file = models.FileField(upload_to="generation_uploads/")
    source_filename = models.CharField(max_length=255)
    question_types = models.JSONField(default=list)
    target_per_domain = models.PositiveIntegerField(default=10)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    progress = models.JSONField(default=dict, blank=True)
    result_summary = models.JSONField(default=dict, blank=True)
    error_message = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"GenerationJob {self.id} ({self.status})"
