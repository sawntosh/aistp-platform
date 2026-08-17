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
