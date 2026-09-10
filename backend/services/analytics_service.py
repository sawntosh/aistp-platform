"""
Aggregation logic for FR-05 (dashboard) and FR-07 (weighted delivery).
"""
from django.db.models import Avg, Count, Q

from analytics.models import PerformanceAnalytics
from questions.constants import (
    CONFIDENCE_LABELS,
    HIGH_CONFIDENCE_MIN,
    LOW_CONFIDENCE_MAX,
)
from questions.models import Attempt, PracticeSession


def record_attempt(user, domain, is_correct):
    """FR-03: update the user's per-domain running total after an Attempt
    is scored. Deterministic bookkeeping only -- no AI involved."""
    record, _ = PerformanceAnalytics.objects.get_or_create(user=user, domain=domain)
    record.total_count += 1
    if is_correct:
        record.correct_count += 1
    record.save(update_fields=["correct_count", "total_count", "last_updated"])
    return record


def revise_attempt_correctness(user, domain, was_correct, now_correct):
    """Adjust the per-domain running total when an existing Attempt is
    edited (the learner changed a saved answer before finishing the exam).
    The total_count is unchanged -- it's still one answer for that question
    -- only correct_count shifts by the delta."""
    if bool(was_correct) == bool(now_correct):
        return
    record, _ = PerformanceAnalytics.objects.get_or_create(user=user, domain=domain)
    record.correct_count = max(record.correct_count + (1 if now_correct else -1), 0)
    record.save(update_fields=["correct_count", "last_updated"])
    return record


def get_domain_accuracy(user):
    """Return per-domain accuracy dicts for the given user, reading from
    analytics.models.PerformanceAnalytics. Sorted weakest domain first."""
    records = PerformanceAnalytics.objects.filter(user=user).select_related("domain")
    domains = [
        {
            "domain": record.domain.name,
            "correct_count": record.correct_count,
            "total_count": record.total_count,
            "accuracy_percent": record.accuracy_percent,
        }
        for record in records
    ]
    return sorted(domains, key=lambda d: d["accuracy_percent"])


def get_weakest_domains(user, limit=2):
    return get_domain_accuracy(user)[:limit]


# -- Confidence diagnostics (Test Mode only) --------------------------------
#
# All of the following are DERIVED from Attempt rows -- no extra tables, no
# change to PerformanceAnalytics or to the correct/total accuracy above.
# Only attempts from Test Mode sessions that carry a 1-5 confidence value
# are considered.

def _test_confidence_attempts(user):
    return Attempt.objects.filter(
        user=user,
        session__mode=PracticeSession.Mode.TEST,
        confidence__isnull=False,
    )


def get_confidence_summary(user):
    """Overall confidence diagnostics for the learner's Test Mode history:

        - average_confidence: mean of all 1-5 ratings (None if no data)
        - by_level: accuracy within each confidence level 1..5
        - high_confidence_mistakes: wrong answers rated >= HIGH_CONFIDENCE_MIN
        - low_confidence_correct: right answers rated <= LOW_CONFIDENCE_MAX
        - rated_count: how many attempts carried a confidence rating
    """
    attempts = _test_confidence_attempts(user)

    agg = attempts.aggregate(
        average=Avg("confidence"),
        rated=Count("id"),
        high_conf_mistakes=Count("id", filter=Q(confidence__gte=HIGH_CONFIDENCE_MIN, is_correct=False)),
        low_conf_correct=Count("id", filter=Q(confidence__lte=LOW_CONFIDENCE_MAX, is_correct=True)),
    )

    per_level = {
        row["confidence"]: row
        for row in attempts.values("confidence").annotate(
            total=Count("id"),
            correct=Count("id", filter=Q(is_correct=True)),
        )
    }
    by_level = []
    for level in range(1, 6):
        row = per_level.get(level)
        total = row["total"] if row else 0
        correct = row["correct"] if row else 0
        by_level.append(
            {
                "level": level,
                "label": CONFIDENCE_LABELS[level],
                "correct": correct,
                "total": total,
                "accuracy_percent": round((correct / total) * 100, 1) if total else None,
            }
        )

    average = agg["average"]
    return {
        "average_confidence": round(average, 2) if average is not None else None,
        "rated_count": agg["rated"],
        "by_level": by_level,
        "high_confidence_mistakes": agg["high_conf_mistakes"],
        "low_confidence_correct": agg["low_conf_correct"],
    }


def get_domain_confidence(user):
    """Per-domain confidence diagnostics for Test Mode history, keyed by
    domain name. Does NOT include or alter domain accuracy -- callers merge
    this onto get_domain_accuracy()'s output by name."""
    rows = (
        _test_confidence_attempts(user)
        .values("question__domain__name")
        .annotate(
            average_confidence=Avg("confidence"),
            high_confidence_mistakes=Count(
                "id", filter=Q(confidence__gte=HIGH_CONFIDENCE_MIN, is_correct=False)
            ),
            low_confidence_correct=Count(
                "id", filter=Q(confidence__lte=LOW_CONFIDENCE_MAX, is_correct=True)
            ),
        )
    )
    return {
        row["question__domain__name"]: {
            "average_confidence": round(row["average_confidence"], 2)
            if row["average_confidence"] is not None
            else None,
            "high_confidence_mistakes": row["high_confidence_mistakes"],
            "low_confidence_correct": row["low_confidence_correct"],
        }
        for row in rows
    }
