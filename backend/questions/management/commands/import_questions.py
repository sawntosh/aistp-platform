"""
questions/management/commands/import_questions.py -- CLI alternative to the
admin JSON-upload API endpoint. Reuses the same validation/persistence
logic (questions/imports.py) so a file that's accepted here is exactly what
the admin UI would have accepted too, and vice versa.

Usage:
    python manage.py import_questions path/to/domain_1_fundamentals_of_testing.json
    python manage.py import_questions domain_1_*.json domain_2_*.json   # multiple files in one go
"""
import json

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from questions.imports import import_questions, validate_rows


class Command(BaseCommand):
    help = "Bulk-import questions from one or more JSON files."

    def add_arguments(self, parser):
        parser.add_argument("files", nargs="+", help="Path(s) to JSON files, each an array of question objects.")

    def handle(self, *args, **options):
        for path in options["files"]:
            self.stdout.write(f"Importing {path} ...")
            try:
                with open(path, encoding="utf-8") as f:
                    rows = json.load(f)
            except FileNotFoundError:
                raise CommandError(f"File not found: {path}")
            except json.JSONDecodeError as exc:
                raise CommandError(f"{path} is not valid JSON: {exc}")

            cleaned_rows, errors = validate_rows(rows)
            if errors:
                self.stderr.write(self.style.ERROR(f"{path}: {len(errors)} row(s) failed validation, nothing imported:"))
                for error in errors:
                    row_label = f"Row {error['row'] + 1}" if error["row"] is not None else "File"
                    self.stderr.write(f"  {row_label}: {error['error']}")
                continue

            with transaction.atomic():
                summary = import_questions(cleaned_rows)

            self.stdout.write(self.style.SUCCESS(f"{path}: imported {summary['created']} question(s)."))
            for domain_name, count in summary["domains"].items():
                self.stdout.write(f"  {domain_name}: {count}")
