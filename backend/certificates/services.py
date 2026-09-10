"""Eligibility helpers -- what makes a session worth a certificate."""
from questions.models import PracticeSession

from .models import Certificate


def session_score_percent(session):
    if not session.question_count or session.score is None:
        return 0
    return round(session.score / session.question_count * 100)


def session_is_certifiable(session):
    """True for a finished Real Exam passed at or above the threshold.

    Only the Real Exam (mode="test") earns a certificate -- Practice Mode
    and the ISTQB Mock Test never do.
    """
    return (
        session.mode == PracticeSession.Mode.TEST
        and session.finished_at is not None
        and session_score_percent(session) >= Certificate.PASS_THRESHOLD
    )


def default_recipient_name(user):
    full = f"{user.first_name} {user.last_name}".strip()
    return full or user.username
