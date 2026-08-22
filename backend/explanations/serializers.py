"""
explanations/serializers.py -- FR-04: AI Explanation (Groq)
"""
import json

from rest_framework import serializers

from .models import AIExplanation


class ExplainRequestSerializer(serializers.Serializer):
    question_id = serializers.IntegerField()


class AIExplanationSerializer(serializers.ModelSerializer):
    explanation = serializers.SerializerMethodField()
    # Always False here: a persisted AIExplanation is only ever created from
    # a real Groq response (see ExplainView) -- the fallback path never
    # reaches this serializer. Included so the response contract is stable.
    is_fallback = serializers.SerializerMethodField()

    class Meta:
        model = AIExplanation
        fields = ("explanation", "is_fallback")

    def get_explanation(self, obj):
        # explanation_text stores the {"items", "summary"} payload as JSON.
        # Rows cached before this format existed hold plain text instead --
        # degrade those into the same shape rather than erroring.
        try:
            parsed = json.loads(obj.explanation_text)
            if isinstance(parsed, dict) and "items" in parsed:
                return parsed
        except (ValueError, TypeError):
            pass
        return {"items": [], "summary": obj.explanation_text}

    def get_is_fallback(self, obj):
        return False
