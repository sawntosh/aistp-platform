"""
explanations/serializers.py -- FR-04: AI Explanation (Gemini)
"""
from rest_framework import serializers

from .models import AIExplanation


class ExplainRequestSerializer(serializers.Serializer):
    question_id = serializers.IntegerField()


class AIExplanationSerializer(serializers.ModelSerializer):
    explanation = serializers.CharField(source="explanation_text")
    # Always False here: a persisted AIExplanation is only ever created from
    # a real Gemini response (see ExplainView) -- the fallback path never
    # reaches this serializer. Included so the response contract is stable.
    is_fallback = serializers.SerializerMethodField()

    class Meta:
        model = AIExplanation
        fields = ("explanation", "is_fallback")

    def get_is_fallback(self, obj):
        return False
