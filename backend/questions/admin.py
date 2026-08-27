from django.contrib import admin

from .models import (
    AnswerOption,
    Attempt,
    Domain,
    DomainResource,
    FillBlankAnswer,
    GenerationJob,
    MatchingPair,
    PracticeSession,
    Question,
    Topic,
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
    list_display = ("id", "domain", "topic", "question_type", "difficulty", "learning_objective_id", "is_active", "created_at")
    list_filter = ("domain", "topic", "question_type", "difficulty", "is_active")
    search_fields = ("text", "learning_objective_id", "learning_objective")
    inlines = [AnswerOptionInline, FillBlankAnswerInline, MatchingPairInline]


@admin.register(Topic)
class TopicAdmin(admin.ModelAdmin):
    list_display = ("id", "domain", "title", "order", "is_active")
    list_filter = ("domain", "is_active")
    search_fields = ("title", "description")
    ordering = ("domain", "order")


@admin.register(GenerationJob)
class GenerationJobAdmin(admin.ModelAdmin):
    list_display = ("id", "source_filename", "status", "target_per_domain", "created_by", "created_at")
    list_filter = ("status",)
    readonly_fields = ("progress", "result_summary", "error_message", "created_at", "updated_at")


class DomainResourceInline(admin.TabularInline):
    model = DomainResource
    extra = 1


@admin.register(Domain)
class DomainAdmin(admin.ModelAdmin):
    list_display = ("id", "name")
    inlines = [DomainResourceInline]


@admin.register(PracticeSession)
class PracticeSessionAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "mode", "started_at", "finished_at", "question_count", "score")
    list_filter = ("mode",)


@admin.register(Attempt)
class AttemptAdmin(admin.ModelAdmin):
    list_display = ("id", "session", "user", "question", "is_correct", "answered_at")
