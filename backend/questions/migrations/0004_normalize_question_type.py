from django.db import migrations

VALID_TYPES = {"mcq", "true_false", "multi_select", "fill_blank", "matching"}


def normalize_question_type(apps, schema_editor):
    Question = apps.get_model("questions", "Question")
    for question in Question.objects.exclude(question_type__in=VALID_TYPES):
        question.question_type = "mcq"
        question.save(update_fields=["question_type"])


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("questions", "0003_attempt_matching_response_attempt_selected_options_and_more"),
    ]

    operations = [
        migrations.RunPython(normalize_question_type, noop),
    ]
