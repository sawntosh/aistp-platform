"""
Aggregation logic for FR-05 (dashboard) and FR-07 (weighted delivery).
"""


def get_domain_accuracy(user):
    """Return per-domain accuracy dicts for the given user, reading from
    analytics.models.PerformanceAnalytics."""
    raise NotImplementedError


def get_weakest_domains(user, limit=2):
    raise NotImplementedError
