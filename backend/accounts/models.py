"""
accounts/models.py
See report Section 4.7 (Database Design) -- Users table.
Password hashing via Django's built-in hasher (bcrypt configured in
settings.PASSWORD_HASHERS) satisfies NFR-01 / T-01 countermeasures.
"""
from django.conf import settings
from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils import timezone


class User(AbstractUser):
    class Role(models.TextChoices):
        STUDENT = "student", "Student"
        ADMIN = "admin", "Admin"

    role = models.CharField(
        max_length=20, choices=Role.choices, default=Role.STUDENT
    )
    # FR-01: a new account must confirm its email (via the 6-digit code
    # mailed on registration) before it can log in. LoginView returns 403
    # until this is True. Existing accounts are backfilled to True by
    # migration 0002.
    email_verified = models.BooleanField(default=False)

    def __str__(self):
        return f"{self.username} ({self.role})"


class EmailOTP(models.Model):
    """A single-use 6-digit code mailed to a user's address.

    Used for both email verification and password reset (``purpose``). The
    raw code is never stored -- only an HMAC of it (see accounts.emails).
    A code is spent once ``consumed_at`` is set: on a correct match, on
    expiry, or once ``attempts`` hits settings.EMAIL_OTP_MAX_ATTEMPTS.
    Issuing a fresh code for the same (user, purpose) consumes any older
    outstanding one.
    """

    class Purpose(models.TextChoices):
        VERIFY_EMAIL = "verify_email", "Verify email"
        PASSWORD_RESET = "password_reset", "Password reset"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="email_otps",
    )
    purpose = models.CharField(max_length=20, choices=Purpose.choices)
    code_hash = models.CharField(max_length=64)
    created_at = models.DateTimeField(auto_now_add=True)
    attempts = models.PositiveSmallIntegerField(default=0)
    consumed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        indexes = [
            models.Index(fields=["user", "purpose", "consumed_at"]),
        ]
        ordering = ["-created_at"]

    def __str__(self):
        state = "consumed" if self.consumed_at else "live"
        return f"{self.user_id}/{self.purpose} ({state})"

    def is_expired(self) -> bool:
        age = (timezone.now() - self.created_at).total_seconds()
        return age > settings.EMAIL_OTP_MAX_AGE
