"""
questions/serializers.py -- FR-02 (delivery), FR-03 (scoring), FR-06 (admin CRUD).
"""
import os
import random

from rest_framework import serializers

from .models import AnswerOption, Domain, FillBlankAnswer, GenerationJob, MatchingPair, Question


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
    """FR-02: what a learner receives when a session is served.

    - mcq / true_false / multi_select: `options` (never `is_correct`).
    - fill_blank: no extra field -- the learner free-types `text_answer`.
    - matching: `matching_pairs` (id + prompt only) and a separately
      shuffled `match_choices` pool, so the correct pairing isn't given
      away by list order.
    """
    domain = DomainSerializer(read_only=True)
    options = AnswerOptionPublicSerializer(many=True, read_only=True)
    matching_pairs = serializers.SerializerMethodField()
    match_choices = serializers.SerializerMethodField()

    class Meta:
        model = Question
        fields = ("id", "domain", "text", "difficulty", "question_type", "options", "matching_pairs", "match_choices")

    def get_matching_pairs(self, obj):
        if obj.question_type != Question.QuestionType.MATCHING:
            return []
        return [{"id": pair.id, "prompt_text": pair.prompt_text} for pair in obj.matching_pairs.all()]

    def get_match_choices(self, obj):
        if obj.question_type != Question.QuestionType.MATCHING:
            return []
        choices = [pair.match_text for pair in obj.matching_pairs.all()]
        random.shuffle(choices)
        return choices


class AnswerOptionSerializer(serializers.ModelSerializer):
    """Admin-facing: includes is_correct for CRUD."""

    class Meta:
        model = AnswerOption
        fields = ("id", "text", "is_correct")


class FillBlankAnswerSerializer(serializers.ModelSerializer):
    class Meta:
        model = FillBlankAnswer
        fields = ("id", "answer_text")


class MatchingPairSerializer(serializers.ModelSerializer):
    class Meta:
        model = MatchingPair
        fields = ("id", "prompt_text", "match_text")


OPTION_BASED_TYPES = (Question.QuestionType.MCQ, Question.QuestionType.TRUE_FALSE, Question.QuestionType.MULTI_SELECT)


class QuestionAdminSerializer(serializers.ModelSerializer):
    """FR-06: admin CRUD, with nested writable child rows. Which child
    list is required/validated depends on `question_type`:
        mcq / true_false / multi_select -> options
        fill_blank                      -> blank_answers
        matching                        -> matching_pairs
    """
    options = AnswerOptionSerializer(many=True, required=False)
    blank_answers = FillBlankAnswerSerializer(many=True, required=False)
    matching_pairs = MatchingPairSerializer(many=True, required=False)

    class Meta:
        model = Question
        fields = (
            "id",
            "domain",
            "text",
            "difficulty",
            "question_type",
            "cognitive_level",
            "learning_objective_id",
            "learning_objective",
            "source_section",
            "is_active",
            "options",
            "blank_answers",
            "matching_pairs",
            "created_at",
        )
        read_only_fields = ("created_at",)

    def validate(self, attrs):
        qtype = attrs.get("question_type", getattr(self.instance, "question_type", Question.QuestionType.MCQ))
        options = attrs.get("options", [])
        blank_answers = attrs.get("blank_answers", [])
        matching_pairs = attrs.get("matching_pairs", [])

        if qtype in OPTION_BASED_TYPES:
            if len(options) < 2:
                raise serializers.ValidationError({"options": "A question needs at least 2 answer options."})
            correct_count = sum(1 for opt in options if opt.get("is_correct"))
            if qtype == Question.QuestionType.MULTI_SELECT:
                if correct_count < 2:
                    raise serializers.ValidationError(
                        {"options": "A multiple-answer question needs at least 2 correct options."}
                    )
            elif correct_count != 1:
                raise serializers.ValidationError({"options": "Exactly one answer option must be marked correct."})
        elif qtype == Question.QuestionType.FILL_BLANK:
            if not blank_answers:
                raise serializers.ValidationError(
                    {"blank_answers": "A fill-in-the-blank question needs at least 1 accepted answer."}
                )
        elif qtype == Question.QuestionType.MATCHING:
            if len(matching_pairs) < 2:
                raise serializers.ValidationError({"matching_pairs": "A matching question needs at least 2 pairs."})

        return attrs

    def create(self, validated_data):
        options_data = validated_data.pop("options", [])
        blank_answers_data = validated_data.pop("blank_answers", [])
        matching_pairs_data = validated_data.pop("matching_pairs", [])

        question = Question.objects.create(**validated_data)
        self._save_children(question, options_data, blank_answers_data, matching_pairs_data)
        return question

    def update(self, instance, validated_data):
        options_data = validated_data.pop("options", None)
        blank_answers_data = validated_data.pop("blank_answers", None)
        matching_pairs_data = validated_data.pop("matching_pairs", None)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        if options_data is not None:
            instance.options.all().delete()
        if blank_answers_data is not None:
            instance.blank_answers.all().delete()
        if matching_pairs_data is not None:
            instance.matching_pairs.all().delete()

        self._save_children(instance, options_data or [], blank_answers_data or [], matching_pairs_data or [])
        return instance

    @staticmethod
    def _save_children(question, options_data, blank_answers_data, matching_pairs_data):
        if options_data:
            AnswerOption.objects.bulk_create([AnswerOption(question=question, **opt) for opt in options_data])
        if blank_answers_data:
            FillBlankAnswer.objects.bulk_create(
                [FillBlankAnswer(question=question, **answer) for answer in blank_answers_data]
            )
        if matching_pairs_data:
            MatchingPair.objects.bulk_create(
                [
                    MatchingPair(question=question, order=index, **pair)
                    for index, pair in enumerate(matching_pairs_data)
                ]
            )


class AnswerSubmitSerializer(serializers.Serializer):
    """FR-03: input payload for AnswerSubmitView. Exactly one of the four
    answer fields is expected, depending on the question's question_type
    (mcq/true_false -> selected_option_id, multi_select ->
    selected_option_ids, fill_blank -> text_answer, matching ->
    matching_response). AnswerSubmitView checks the right one is present
    once it knows the question's type."""
    session_id = serializers.IntegerField()
    question_id = serializers.IntegerField()
    selected_option_id = serializers.IntegerField(required=False)
    selected_option_ids = serializers.ListField(child=serializers.IntegerField(), required=False)
    text_answer = serializers.CharField(required=False, allow_blank=True)
    matching_response = serializers.DictField(child=serializers.CharField(), required=False)


class GenerationJobSerializer(serializers.ModelSerializer):
    """Read-only status/progress payload the admin UI polls."""

    class Meta:
        model = GenerationJob
        fields = (
            "id",
            "source_filename",
            "question_types",
            "target_per_domain",
            "status",
            "progress",
            "result_summary",
            "error_message",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields


class GenerationJobCreateSerializer(serializers.Serializer):
    """Validates the "generate from document" upload. Not a
    ModelSerializer since the uploaded `file` maps onto the model's
    `source_file` -- the view builds the GenerationJob row itself from
    validated_data."""
    file = serializers.FileField()
    question_types = serializers.ListField(
        child=serializers.ChoiceField(choices=Question.QuestionType.choices),
        required=False,
        default=list,
    )
    target_per_domain = serializers.IntegerField(required=False, default=10, min_value=1, max_value=30)

    def validate_file(self, value):
        extension = os.path.splitext(value.name)[1].lower()
        if extension not in (".pdf", ".docx"):
            raise serializers.ValidationError("Upload a PDF or DOCX file.")
        return value

    def validate(self, attrs):
        attrs["question_types"] = attrs.get("question_types") or [choice for choice, _ in Question.QuestionType.choices]
        return attrs
