"""
Confidence-tracking constants (Test Mode).

Confidence is a learner's 1-5 self-rating of how sure they are about an
answer. It is stored on Attempt.confidence and is ONLY a diagnostic
signal -- it never feeds services.scoring_service or the session score.
See services.analytics_service for the derived aggregates.
"""

CONFIDENCE_MIN = 1
CONFIDENCE_MAX = 5

CONFIDENCE_LABELS = {
    1: "Guessing",
    2: "Not sure",
    3: "Somewhat confident",
    4: "Confident",
    5: "Very confident",
}

# A wrong answer submitted at this confidence or higher is flagged as a
# "high-confidence mistake" -- a likely misconception worth reviewing.
HIGH_CONFIDENCE_MIN = 4

# A correct answer submitted at this confidence or lower is a
# "low-confidence correct" -- right, but the learner wasn't sure.
LOW_CONFIDENCE_MAX = 2


def confidence_label(value):
    """Human label for a 1-5 confidence value, or None if unset/invalid."""
    return CONFIDENCE_LABELS.get(value)


def is_high_confidence_mistake(confidence, is_correct):
    return confidence is not None and confidence >= HIGH_CONFIDENCE_MIN and not is_correct


def is_low_confidence_correct(confidence, is_correct):
    return confidence is not None and confidence <= LOW_CONFIDENCE_MAX and bool(is_correct)
