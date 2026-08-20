from django.contrib import admin

from .models import (
    AnswerOption,
    Attempt,
    Domain,
    FillBlankAnswer,
    GenerationJob,
    MatchingPair,
    PracticeSession,
    Question,
)


class AnswerOptionInline(admin.TabularInline):
    model = AnswerOption
    extra = 1


class FillBlankAnswerInline(admin.TabularInline):
    model = FillBlankAnswer
    extra = 1


class MatchingPairInline(admin.TabularInline):
    model = MatchingPair
    extra = 1


@admin.register(Question)
class QuestionAdmin(admin.ModelAdmin):
    list_display = ("id", "domain", "question_type", "difficulty", "learning_objective_id", "is_active", "created_at")
    list_filter = ("domain", "question_type", "difficulty", "is_active")
    search_fields = ("text", "learning_objective_id", "learning_objective")
    inlines = [AnswerOptionInline, FillBlankAnswerInline, MatchingPairInline]


@admin.register(GenerationJob)
class GenerationJobAdmin(admin.ModelAdmin):
    list_display = ("id", "source_filename", "status", "target_per_domain", "created_by", "created_at")
    list_filter = ("status",)
    readonly_fields = ("progress", "result_summary", "error_message", "created_at", "updated_at")


@admin.register(Domain)
class DomainAdmin(admin.ModelAdmin):
    list_display = ("id", "name")


@admin.register(PracticeSession)
class PracticeSessionAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "started_at", "finished_at", "question_count", "score")


@admin.register(Attempt)
class AttemptAdmin(admin.ModelAdmin):
    list_display = ("id", "session", "user", "question", "is_correct", "answered_at")
