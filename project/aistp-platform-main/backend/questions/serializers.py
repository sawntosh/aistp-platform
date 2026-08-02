"""
questions/serializers.py -- FR-02 (Question Delivery)
"""
from rest_framework import serializers

from .models import AnswerOption, Question


class AnswerOptionSerializer(serializers.ModelSerializer):
    """Excludes is_correct so the answer key is never shipped to the
    client until after the learner submits."""

    class Meta:
        model = AnswerOption
        fields = ("id", "text")


class QuestionSerializer(serializers.ModelSerializer):
    domain = serializers.CharField(source="domain.name", read_only=True)
    options = AnswerOptionSerializer(many=True, read_only=True)

    class Meta:
        model = Question
        fields = ("id", "domain", "text", "difficulty", "options")
