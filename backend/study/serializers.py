"""
study/serializers.py -- Study Mode's read shapes. Question delivery
reuses questions.serializers.QuestionPublicSerializer as-is (same
never-leak-is_correct guarantee Test Mode relies on).
"""
from rest_framework import serializers

from .models import StudyContent, StudySession


class StudyContentSerializer(serializers.ModelSerializer):
    class Meta:
        model = StudyContent
        fields = ("id", "title", "content", "updated_at")


class StudySessionSerializer(serializers.ModelSerializer):
    class Meta:
        model = StudySession
        fields = ("id", "topic", "started_at", "content_viewed_at", "completed_at")
