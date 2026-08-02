"""
Aggregation logic for FR-05 (dashboard) and FR-07 (weighted delivery).
"""
from analytics.models import PerformanceAnalytics
from questions.models import Domain


def get_domain_accuracy(user):
    """Return per-domain accuracy dicts for the given user, reading from
    analytics.models.PerformanceAnalytics. Includes every domain, even ones
    the user has never attempted (0% accuracy), so the dashboard and the
    delivery algorithm always see the full six-domain picture."""
    records = {
        pa.domain_id: pa
        for pa in PerformanceAnalytics.objects.filter(user=user).select_related("domain")
    }
    results = []
    for domain in Domain.objects.all():
        pa = records.get(domain.id)
        results.append(
            {
                "domain_id": domain.id,
                "domain": domain.name,
                "correct_count": pa.correct_count if pa else 0,
                "total_count": pa.total_count if pa else 0,
                "accuracy_percent": pa.accuracy_percent if pa else 0,
            }
        )
    return results


def get_weakest_domains(user, limit=2):
    """Return the learner's `limit` weakest domains (lowest accuracy first).
    Domains with no attempts yet count as 0% accuracy, so they're
    prioritised for coverage alongside genuinely weak domains."""
    accuracy = get_domain_accuracy(user)
    accuracy.sort(key=lambda row: row["accuracy_percent"])
    weakest_ids = [row["domain_id"] for row in accuracy[:limit]]
    return list(Domain.objects.filter(id__in=weakest_ids))
