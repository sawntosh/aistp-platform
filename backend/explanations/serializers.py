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
        text = obj.explanation_text
        # A short-lived earlier version of this feature cached explanations
        # as {"items": [...], "summary": ...} JSON instead of plain text --
        # flatten any such row back into readable text rather than showing
        # a raw JSON blob to rows cached during that window.
        try:
            parsed = json.loads(text)
        except (ValueError, TypeError):
            return text
        if not isinstance(parsed, dict) or "items" not in parsed:
            return text

        lines = []
        for item in parsed.get("items", []):
            verdict = "Correct" if item.get("correct") else "Incorrect"
            line = f"{item.get('option')}: {verdict}."
            if item.get("reason"):
                line += f" {item['reason']}"
            lines.append(line)
        if parsed.get("summary"):
            lines.append(parsed["summary"])
        return "\n".join(lines) if lines else text

    def get_is_fallback(self, obj):
        return False
