"""
analytics/models.py
PerformanceAnalytics -- Report Section 4.7 / FR-05, FR-07.
Aggregated, per-user, per-domain accuracy used both by the dashboard
and by the weighted-domain question delivery algorithm (FR-07).
"""
from django.conf import settings
from django.db import models
from questions.models import Domain


class PerformanceAnalytics(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="performance")
    domain = models.ForeignKey(Domain, on_delete=models.CASCADE)
    correct_count = models.PositiveIntegerField(default=0)
    total_count = models.PositiveIntegerField(default=0)
    last_updated = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("user", "domain")

    @property
    def accuracy_percent(self):
        if self.total_count == 0:
            return 0
        return round((self.correct_count / self.total_count) * 100, 1)

    def __str__(self):
        return f"{self.user} - {self.domain}: {self.accuracy_percent}%"
