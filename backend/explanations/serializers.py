"""
explanations/serializers.py -- FR-04: AI Explanation (Gemini)
"""
from rest_framework import serializers

from .models import AIExplanation


class ExplainRequestSerializer(serializers.Serializer):
    question_id = serializers.IntegerField()


class AIExplanationSerializer(serializers.ModelSerializer):
    explanation = serializers.CharField(source="explanation_text")

    class Meta:
        model = AIExplanation
        fields = ("explanation",)
