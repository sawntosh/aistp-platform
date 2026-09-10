"""
certificates/models.py

A Certificate is issued once per passing Real Exam session (score at or
above PASS_THRESHOLD). It carries its own public, shareable id and the
recipient's chosen display name; verification and the downloadable PDF
both key off `certificate_id`.
"""
import secrets

from django.conf import settings
from django.db import models
from django.utils import timezone

from questions.models import PracticeSession

# Unambiguous alphabet for the human-facing id (no O/0, I/1).
_ID_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"


def generate_certificate_id():
    year = timezone.now().year
    suffix = "".join(secrets.choice(_ID_ALPHABET) for _ in range(6))
    return f"AISTP-{year}-{suffix}"


class Certificate(models.Model):
    # Percent needed to earn the certificate. Mirrors
    # questions.views.EXAM_PASS_PERCENT (the ISTQB CTFL standard).
    PASS_THRESHOLD = 65

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="certificates"
    )
    # One certificate per session. Kept nullable so a session can be pruned
    # without destroying the (still verifiable) certificate record.
    session = models.OneToOneField(
        PracticeSession,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="certificate",
    )
    certificate_id = models.CharField(max_length=32, unique=True, editable=False)
    recipient_name = models.CharField(max_length=120)
    exam_label = models.CharField(
        max_length=150, default="AISTP Software Testing Certification"
    )
    score_percent = models.PositiveSmallIntegerField()
    issued_at = models.DateTimeField(auto_now_add=True)
    revoked = models.BooleanField(default=False)

    class Meta:
        ordering = ["-issued_at"]

    def save(self, *args, **kwargs):
        if not self.certificate_id:
            for _ in range(10):
                candidate = generate_certificate_id()
                if not Certificate.objects.filter(certificate_id=candidate).exists():
                    self.certificate_id = candidate
                    break
            else:  # pragma: no cover - astronomically unlikely
                raise RuntimeError("Could not allocate a unique certificate id")
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.certificate_id} - {self.recipient_name}"
