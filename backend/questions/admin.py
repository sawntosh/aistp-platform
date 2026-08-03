from django.contrib import admin

from .models import AnswerOption, Attempt, Domain, PracticeSession, Question


class AnswerOptionInline(admin.TabularInline):
    model = AnswerOption
    extra = 1


@admin.register(Question)
class QuestionAdmin(admin.ModelAdmin):
    list_display = ("id", "domain", "difficulty", "is_active", "created_at")
    list_filter = ("domain", "difficulty", "is_active")
    inlines = [AnswerOptionInline]


@admin.register(Domain)
class DomainAdmin(admin.ModelAdmin):
    list_display = ("id", "name")


@admin.register(PracticeSession)
class PracticeSessionAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "started_at", "finished_at", "question_count", "score")


@admin.register(Attempt)
class AttemptAdmin(admin.ModelAdmin):
    list_display = ("id", "session", "user", "question", "is_correct", "answered_at")
