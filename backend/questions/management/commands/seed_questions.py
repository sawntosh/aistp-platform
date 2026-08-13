"""
questions/management/commands/seed_questions.py -- loads the question bank
that ships with the repo (questions/fixtures/seed_questions.json) into a
fresh database. Every clone gets the same 62 questions across 6 domains
without anyone having to re-upload a JSON file by hand.

Usage:
    python manage.py seed_questions            # skips if questions already exist
    python manage.py seed_questions --force     # re-imports on top of existing data
"""
import json
from pathlib import Path

from django.core.management.base import BaseCommand
from django.db import transaction

from questions.imports import import_questions, validate_rows
from questions.models import Question

FIXTURE_PATH = Path(__file__).resolve().parent.parent.parent / "fixtures" / "seed_questions.json"


class Command(BaseCommand):
    help = "Seed the database with the question bank bundled in the repo."

    def add_arguments(self, parser):
        parser.add_argument(
            "--force",
            action="store_true",
            help="Import even if questions already exist in the database.",
        )

    def handle(self, *args, **options):
        if Question.objects.exists() and not options["force"]:
            self.stdout.write(
                self.style.WARNING(
                    f"Database already has {Question.objects.count()} question(s) -- skipping. "
                    "Use --force to import anyway."
                )
            )
            return

        with open(FIXTURE_PATH, encoding="utf-8") as f:
            rows = json.load(f)

        cleaned_rows, errors = validate_rows(rows)
        if errors:
            for error in errors:
                row_label = f"Row {error['row'] + 1}" if error["row"] is not None else "File"
                self.stderr.write(self.style.ERROR(f"{row_label}: {error['error']}"))
            return

        with transaction.atomic():
            summary = import_questions(cleaned_rows)

        self.stdout.write(self.style.SUCCESS(f"Seeded {summary['created']} question(s)."))
        for domain_name, count in summary["domains"].items():
            self.stdout.write(f"  {domain_name}: {count}")
