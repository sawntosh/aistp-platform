"""
questions/imports.py -- bulk JSON import of question rows across all 5
question types (admin JSON upload, FR-06 extension for the
question-import-model feature).

Each row is a JSON object in a top-level array; "Question Type" selects
which shape the rest of the row must match (missing/blank defaults to
MCQ, for backward compatibility with files that predate the other 4
types):

    MCQ / Multiple Choice
        "Option A".."Option F" (2+ of them), "Correct Option": "B"

    True/False
        "Correct Answer": "True" | "False"

    Multiple Answer
        "Option A".."Option F" (2+ of them),
        "Correct Options": ["A", "C"]   (2 or more)

    Fill in the Blank
        "Correct Answer": "text"        (the accepted answer)
        "Accepted Answers": ["...", ...]  (optional extra accepted phrasings)

    Matching Pairs
        "Pairs": [{"Left": "...", "Right": "..."}, ...]   (2+ entries)

All row shapes share: "Domain", "Difficulty", "Question Text", plus the
optional "Cognitive Level" / "Learning Objective ID" / "Learning
Objective" / "Source Section" metadata carried over from RAG-generated
exports. Domains are matched/created by exact name, so the same
"Domain" string used across files for one of the six syllabus domains
lands on a single Domain row.
"""
from .models import AnswerOption, Domain, FillBlankAnswer, MatchingPair, Question

BASE_REQUIRED_FIELDS = ["Domain", "Difficulty", "Question Text"]
OPTION_LETTERS = ["A", "B", "C", "D", "E", "F"]
DIFFICULTY_MAP = {choice.lower(): value for value, choice in Question.Difficulty.choices}

# External "Question Type" spellings (case-insensitive) accepted from an
# uploaded file, mapped onto the internal Question.QuestionType values.
QUESTION_TYPE_MAP = {
    "": Question.QuestionType.MCQ,
    "mcq": Question.QuestionType.MCQ,
    "multiple choice": Question.QuestionType.MCQ,
    "true/false": Question.QuestionType.TRUE_FALSE,
    "true false": Question.QuestionType.TRUE_FALSE,
    "truefalse": Question.QuestionType.TRUE_FALSE,
    "multiple answer": Question.QuestionType.MULTI_SELECT,
    "multi select": Question.QuestionType.MULTI_SELECT,
    "multi_select": Question.QuestionType.MULTI_SELECT,
    "fill in the blank": Question.QuestionType.FILL_BLANK,
    "fill_blank": Question.QuestionType.FILL_BLANK,
    "matching": Question.QuestionType.MATCHING,
    "matching pairs": Question.QuestionType.MATCHING,
}


def _resolve_question_type(raw_value):
    return QUESTION_TYPE_MAP.get(str(raw_value or "").strip().lower())


def _clean_options(row):
    options = []
    for letter in OPTION_LETTERS:
        text = row.get(f"Option {letter}")
        if text is not None and str(text).strip():
            options.append((letter, str(text).strip()))
    return options


def _validate_option_based(row, qtype):
    """MCQ (exactly one correct) and Multiple Answer (two or more
    correct) share the same Option A../Option F shape; only which
    "Correct Option(s)" field they read, and how many must be correct,
    differs. Returns (type_data, error_message)."""
    options = _clean_options(row)
    if len(options) < 2:
        return None, "A question needs at least 2 options."
    valid_letters = {letter for letter, _ in options}

    if qtype == Question.QuestionType.MULTI_SELECT:
        raw_correct = row.get("Correct Options")
        if not raw_correct:
            return None, "Missing required field: Correct Options"
        if not isinstance(raw_correct, list):
            return None, "Correct Options must be a list of option letters, e.g. [\"A\", \"C\"]."
        correct_letters = {str(value).strip().upper() for value in raw_correct}
        if not correct_letters.issubset(valid_letters):
            return None, "Correct Options references a letter with no matching Option."
        if len(correct_letters) < 2:
            return None, "A Multiple Answer question needs at least 2 correct options."
    else:
        raw_correct = row.get("Correct Option")
        if not str(raw_correct or "").strip():
            return None, "Missing required field: Correct Option"
        correct_letter = str(raw_correct).strip().upper()
        if correct_letter not in valid_letters:
            return None, f"Correct Option '{raw_correct}' does not match a provided option."
        correct_letters = {correct_letter}

    return {"options": [{"text": text, "is_correct": letter in correct_letters} for letter, text in options]}, None


def _validate_true_false(row):
    raw = row.get("Correct Answer")
    if raw is None or str(raw).strip() == "":
        return None, "Missing required field: Correct Answer"
    if isinstance(raw, bool):
        is_true = raw
    else:
        text = str(raw).strip().lower()
        if text not in ("true", "false"):
            return None, "Correct Answer must be True or False for a True/False question."
        is_true = text == "true"
    return {"is_true": is_true}, None


def _validate_fill_blank(row):
    raw = row.get("Correct Answer")
    if not str(raw or "").strip():
        return None, "Missing required field: Correct Answer"
    answers = [str(raw).strip()]
    extra = row.get("Accepted Answers")
    if isinstance(extra, list):
        answers.extend(str(value).strip() for value in extra if str(value).strip())
    return {"answers": answers}, None


def _validate_matching(row):
    raw_pairs = row.get("Pairs")
    if not isinstance(raw_pairs, list):
        return None, "Missing required field: Pairs (a list of {\"Left\": ..., \"Right\": ...} objects)."

    pairs = []
    for pair in raw_pairs:
        if not isinstance(pair, dict):
            return None, "Each entry in Pairs must be an object with Left and Right."
        left = str(pair.get("Left", "")).strip()
        right = str(pair.get("Right", "")).strip()
        if not left and not right:
            continue  # a blank template row some tools leave in the array (e.g. "Add Pair")
        if not left or not right:
            return None, "Every entry in Pairs needs both a Left and a Right."
        pairs.append({"prompt_text": left, "match_text": right})

    if len(pairs) < 2:
        return None, "A Matching question needs at least 2 non-empty pairs."

    return {"pairs": pairs}, None


VALIDATORS_BY_TYPE = {
    Question.QuestionType.MCQ: lambda row: _validate_option_based(row, Question.QuestionType.MCQ),
    Question.QuestionType.MULTI_SELECT: lambda row: _validate_option_based(row, Question.QuestionType.MULTI_SELECT),
    Question.QuestionType.TRUE_FALSE: _validate_true_false,
    Question.QuestionType.FILL_BLANK: _validate_fill_blank,
    Question.QuestionType.MATCHING: _validate_matching,
}


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

        missing = [field for field in BASE_REQUIRED_FIELDS if not str(row.get(field, "")).strip()]
        if missing:
            errors.append({"row": index, "error": f"Missing required field(s): {', '.join(missing)}"})
            continue

        qtype = _resolve_question_type(row.get("Question Type"))
        if qtype is None:
            errors.append({"row": index, "error": f"Unrecognized Question Type '{row.get('Question Type')}'."})
            continue

        difficulty = DIFFICULTY_MAP.get(str(row["Difficulty"]).strip().lower())
        if difficulty is None:
            errors.append(
                {"row": index, "error": f"Invalid Difficulty '{row['Difficulty']}' (expected Easy/Medium/Hard)."}
            )
            continue

        type_data, error_message = VALIDATORS_BY_TYPE[qtype](row)
        if error_message:
            errors.append({"row": index, "error": error_message})
            continue

        cleaned.append(
            {
                "domain_name": str(row["Domain"]).strip(),
                "text": str(row["Question Text"]).strip(),
                "difficulty": difficulty,
                "question_type": qtype,
                "cognitive_level": str(row.get("Cognitive Level", "")).strip(),
                "learning_objective_id": str(row.get("Learning Objective ID", "")).strip(),
                "learning_objective": str(row.get("Learning Objective", "")).strip(),
                "source_section": str(row.get("Source Section", "")).strip(),
                **type_data,
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

        qtype = row["question_type"]
        if qtype in (Question.QuestionType.MCQ, Question.QuestionType.MULTI_SELECT):
            AnswerOption.objects.bulk_create(
                AnswerOption(question=question, text=opt["text"], is_correct=opt["is_correct"])
                for opt in row["options"]
            )
        elif qtype == Question.QuestionType.TRUE_FALSE:
            is_true = row["is_true"]
            AnswerOption.objects.bulk_create(
                [
                    AnswerOption(question=question, text="True", is_correct=is_true),
                    AnswerOption(question=question, text="False", is_correct=not is_true),
                ]
            )
        elif qtype == Question.QuestionType.FILL_BLANK:
            FillBlankAnswer.objects.bulk_create(
                FillBlankAnswer(question=question, answer_text=answer) for answer in row["answers"]
            )
        else:  # matching
            MatchingPair.objects.bulk_create(
                MatchingPair(question=question, order=i, **pair) for i, pair in enumerate(row["pairs"])
            )

        created += 1
        per_domain[domain_name] = per_domain.get(domain_name, 0) + 1

    return {"created": created, "domains": per_domain}
