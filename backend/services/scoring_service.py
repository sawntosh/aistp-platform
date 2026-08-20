"""
Deterministic, rule-based scoring only.
Per report ("How NOT to Use AI"): scoring must never be AI-generated.
"""
import re


def _normalize_text(value: str) -> str:
    return re.sub(r"\s+", " ", (value or "").strip().lower())


def score_answer(question, submission: dict) -> bool:
    """Return True if `submission` is a fully correct answer to `question`,
    dispatching on question.question_type. `submission` is the relevant
    slice of the validated AnswerSubmitSerializer payload -- see
    questions.views.AnswerSubmitView for how each shape is built."""
    from questions.models import Question

    qtype = question.question_type

    if qtype in (Question.QuestionType.MCQ, Question.QuestionType.TRUE_FALSE):
        selected_option = submission.get("selected_option")
        return bool(selected_option and selected_option.is_correct)

    if qtype == Question.QuestionType.MULTI_SELECT:
        selected_options = submission.get("selected_options") or []
        correct_ids = set(question.options.filter(is_correct=True).values_list("id", flat=True))
        selected_ids = {option.id for option in selected_options}
        return bool(selected_ids) and selected_ids == correct_ids

    if qtype == Question.QuestionType.FILL_BLANK:
        text_answer = _normalize_text(submission.get("text_answer", ""))
        if not text_answer:
            return False
        accepted = {_normalize_text(a) for a in question.blank_answers.values_list("answer_text", flat=True)}
        return text_answer in accepted

    if qtype == Question.QuestionType.MATCHING:
        matching_response = submission.get("matching_response") or {}
        pairs = list(question.matching_pairs.all())
        if not pairs or len(matching_response) != len(pairs):
            return False
        return all(
            _normalize_text(matching_response.get(str(pair.id), "")) == _normalize_text(pair.match_text)
            for pair in pairs
        )

    return False
