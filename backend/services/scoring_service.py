"""
Deterministic, rule-based scoring only.
Per report ("How NOT to Use AI"): scoring must never be AI-generated.
"""


def score_answer(selected_option) -> bool:
    """Return True if the selected AnswerOption.is_correct is True."""
    return bool(getattr(selected_option, "is_correct", False))
