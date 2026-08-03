"""
Aggregation logic for FR-05 (dashboard) and FR-07 (weighted delivery).
"""
from analytics.models import PerformanceAnalytics


def record_attempt(user, domain, is_correct):
    """FR-03: update the user's per-domain running total after an Attempt
    is scored. Deterministic bookkeeping only -- no AI involved."""
    record, _ = PerformanceAnalytics.objects.get_or_create(user=user, domain=domain)
    record.total_count += 1
    if is_correct:
        record.correct_count += 1
    record.save(update_fields=["correct_count", "total_count", "last_updated"])
    return record


def get_domain_accuracy(user):
    """Return per-domain accuracy dicts for the given user, reading from
    analytics.models.PerformanceAnalytics."""
    raise NotImplementedError


def get_weakest_domains(user, limit=2):
    raise NotImplementedError
