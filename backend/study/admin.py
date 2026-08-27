from django.contrib import admin

from .models import StudyAttempt, StudyContent, StudyProgress, StudySession


@admin.register(StudyContent)
class StudyContentAdmin(admin.ModelAdmin):
    list_display = ("id", "topic", "title", "order", "updated_at")
    list_filter = ("topic__domain",)
    search_fields = ("title", "content")
    autocomplete_fields = ["topic"]


@admin.register(StudySession)
class StudySessionAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "topic", "started_at", "content_viewed_at", "completed_at")
    list_filter = ("topic__domain",)


@admin.register(StudyAttempt)
class StudyAttemptAdmin(admin.ModelAdmin):
    list_display = ("id", "session", "user", "question", "is_correct", "answered_at")
    list_filter = ("is_correct",)


@admin.register(StudyProgress)
class StudyProgressAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "topic", "status", "updated_at")
    list_filter = ("status", "topic__domain")
