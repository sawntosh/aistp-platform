"""
questions/serializers.py -- FR-02 (delivery), FR-03 (scoring), FR-06 (admin CRUD).
"""
from rest_framework import serializers

from .models import AnswerOption, Domain, Question


class DomainSerializer(serializers.ModelSerializer):
    class Meta:
        model = Domain
        fields = ("id", "name", "description")


class AnswerOptionPublicSerializer(serializers.ModelSerializer):
    """Student-facing: never expose is_correct."""

    class Meta:
        model = AnswerOption
        fields = ("id", "text")


class QuestionPublicSerializer(serializers.ModelSerializer):
    """FR-02: what a learner receives when a session is served."""
    domain = DomainSerializer(read_only=True)
    options = AnswerOptionPublicSerializer(many=True, read_only=True)

    class Meta:
        model = Question
        fields = ("id", "domain", "text", "difficulty", "options")


class AnswerOptionSerializer(serializers.ModelSerializer):
    """Admin-facing: includes is_correct for CRUD."""

    class Meta:
        model = AnswerOption
        fields = ("id", "text", "is_correct")


class QuestionAdminSerializer(serializers.ModelSerializer):
    """FR-06: admin CRUD, with nested writable answer options."""
    options = AnswerOptionSerializer(many=True)

    class Meta:
        model = Question
        fields = ("id", "domain", "text", "difficulty", "is_active", "options", "created_at")
        read_only_fields = ("created_at",)

    def validate_options(self, value):
        if len(value) < 2:
            raise serializers.ValidationError("A question needs at least 2 answer options.")
        if sum(1 for opt in value if opt.get("is_correct")) != 1:
            raise serializers.ValidationError("Exactly one answer option must be marked correct.")
        return value

    def create(self, validated_data):
        options_data = validated_data.pop("options")
        question = Question.objects.create(**validated_data)
        AnswerOption.objects.bulk_create(
            [AnswerOption(question=question, **opt) for opt in options_data]
        )
        return question

    def update(self, instance, validated_data):
        options_data = validated_data.pop("options", None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        if options_data is not None:
            instance.options.all().delete()
            AnswerOption.objects.bulk_create(
                [AnswerOption(question=instance, **opt) for opt in options_data]
            )
        return instance


class AnswerSubmitSerializer(serializers.Serializer):
    """FR-03: input payload for AnswerSubmitView."""
    session_id = serializers.IntegerField()
    question_id = serializers.IntegerField()
    selected_option_id = serializers.IntegerField()
