"""
questions/imports.py -- bulk JSON import of ISTQB-style question rows
(admin JSON upload, FR-06 extension for the question-import-model feature).

Expected row shape (one object per question in a top-level JSON array):

    {
      "Domain": "Domain 1 - Fundamentals of Testing",
      "Question Type": "MCQ",
      "Difficulty": "Easy",
      "Cognitive Level": "K1",
      "Learning Objective ID": "1.1.1",
      "Learning Objective": "Identify typical test objectives",
      "Question Text": "Which of the following is a typical test objective?",
      "Option A": "...", "Option B": "...", "Option C": "...", "Option D": "...",
      "Correct Option": "B",
      "Source Section": "1.1.1 Test Objectives"
    }

Option C/D are optional (2-4 options per question). Domains are matched/
created by exact name, so the same "Domain" string used across files for
one of the six syllabus domains lands on a single Domain row.
"""
from .models import AnswerOption, Domain, Question

REQUIRED_FIELDS = ["Domain", "Difficulty", "Question Text", "Option A", "Option B", "Correct Option"]
OPTION_LETTERS = ["A", "B", "C", "D"]
DIFFICULTY_MAP = {choice.lower(): value for value, choice in Question.Difficulty.choices}


def validate_rows(rows):
    """Validate a list of raw question dicts.

    Returns (cleaned_rows, errors). errors is a list of {"row": index, "error": msg}.
    cleaned_rows is only meaningful when errors is empty -- validation is
    all-or-nothing so a bad row never causes a partial import.
    """
    if not isinstance(rows, list):
        return [], [{"row": None, "error": "Expected a JSON array of question objects."}]

    cleaned = []
    errors = []
    for index, row in enumerate(rows):
        if not isinstance(row, dict):
            errors.append({"row": index, "error": "Each item must be a JSON object."})
            continue

        missing = [field for field in REQUIRED_FIELDS if not str(row.get(field, "")).strip()]
        if missing:
            errors.append({"row": index, "error": f"Missing required field(s): {', '.join(missing)}"})
            continue

        difficulty = DIFFICULTY_MAP.get(str(row["Difficulty"]).strip().lower())
        if difficulty is None:
            errors.append(
                {"row": index, "error": f"Invalid Difficulty '{row['Difficulty']}' (expected Easy/Medium/Hard)."}
            )
            continue

        options = []
        for letter in OPTION_LETTERS:
            text = row.get(f"Option {letter}")
            if text is not None and str(text).strip():
                options.append((letter, str(text).strip()))
        if len(options) < 2:
            errors.append({"row": index, "error": "A question needs at least 2 options."})
            continue

        correct_letter = str(row["Correct Option"]).strip().upper()
        if correct_letter not in [letter for letter, _ in options]:
            errors.append(
                {"row": index, "error": f"Correct Option '{row['Correct Option']}' does not match a provided option."}
            )
            continue

        cleaned.append(
            {
                "domain_name": str(row["Domain"]).strip(),
                "text": str(row["Question Text"]).strip(),
                "difficulty": difficulty,
                "question_type": str(row.get("Question Type", "")).strip(),
                "cognitive_level": str(row.get("Cognitive Level", "")).strip(),
                "learning_objective_id": str(row.get("Learning Objective ID", "")).strip(),
                "learning_objective": str(row.get("Learning Objective", "")).strip(),
                "source_section": str(row.get("Source Section", "")).strip(),
                "options": [{"text": text, "is_correct": letter == correct_letter} for letter, text in options],
            }
        )

    return cleaned, errors


def import_questions(rows):
    """Persist rows already produced by validate_rows(). Caller wraps this
    in a transaction so a mid-import failure can't leave a partial batch."""
    domain_cache = {}
    created = 0
    per_domain = {}

    for row in rows:
        domain_name = row["domain_name"]
        if domain_name not in domain_cache:
            domain_cache[domain_name], _ = Domain.objects.get_or_create(name=domain_name)
        domain = domain_cache[domain_name]

        question = Question.objects.create(
            domain=domain,
            text=row["text"],
            difficulty=row["difficulty"],
            question_type=row["question_type"],
            cognitive_level=row["cognitive_level"],
            learning_objective_id=row["learning_objective_id"],
            learning_objective=row["learning_objective"],
            source_section=row["source_section"],
        )
        AnswerOption.objects.bulk_create(
            [AnswerOption(question=question, text=opt["text"], is_correct=opt["is_correct"]) for opt in row["options"]]
        )
        created += 1
        per_domain[domain_name] = per_domain.get(domain_name, 0) + 1

    return {"created": created, "domains": per_domain}
