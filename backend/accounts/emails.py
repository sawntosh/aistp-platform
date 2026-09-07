"""
accounts/emails.py -- email-verification token + delivery.

The token is a stateless django.core.signing token (no extra table): it
carries the user id, is signed with SECRET_KEY, and expires after
settings.EMAIL_VERIFICATION_MAX_AGE. "Resend" just mints a new one.
"""
import hashlib

from django.conf import settings
from django.core import signing
from django.core.mail import send_mail

_SALT = "accounts.email-verify"
_PWRESET_SALT = "accounts.password-reset"


class VerificationTokenError(Exception):
    """Invalid, tampered, or expired verification token."""


class PasswordResetTokenError(Exception):
    """Invalid, tampered, expired, or already-used password-reset token."""


def make_token(user) -> str:
    return signing.dumps({"uid": user.pk}, salt=_SALT)


def read_token(token: str) -> int:
    """Return the user id encoded in a still-valid token, or raise
    VerificationTokenError."""
    try:
        data = signing.loads(
            token, salt=_SALT, max_age=settings.EMAIL_VERIFICATION_MAX_AGE
        )
    except signing.SignatureExpired as exc:
        raise VerificationTokenError("This verification link has expired.") from exc
    except signing.BadSignature as exc:
        raise VerificationTokenError("This verification link is invalid.") from exc
    return data["uid"]


def verification_link(token: str) -> str:
    base = settings.FRONTEND_BASE_URL.rstrip("/")
    return f"{base}/verify-email?token={token}"


def send_verification_email(user) -> None:
    """Mail (or, with the console backend, print) the verification link.
    Best-effort: a mail-transport failure must not 500 the registration."""
    link = verification_link(make_token(user))
    subject = "Verify your AISTP account"
    body = (
        f"Hi {user.username},\n\n"
        "Confirm your email address to activate your AISTP account:\n\n"
        f"{link}\n\n"
        "If you didn't create this account, you can ignore this message.\n"
    )
    send_mail(
        subject,
        body,
        settings.DEFAULT_FROM_EMAIL,
        [user.email],
        fail_silently=True,
    )


# -- Password reset -------------------------------------------------------
# Same stateless-token approach as verification, plus a fingerprint of the
# current password hash baked into the payload: once the password changes
# the fingerprint no longer matches, so a reset link is single-use and any
# older outstanding links stop working too.


def password_fingerprint(user) -> str:
    return hashlib.sha256(user.password.encode()).hexdigest()[:16]


def make_password_reset_token(user) -> str:
    return signing.dumps(
        {"uid": user.pk, "pw": password_fingerprint(user)}, salt=_PWRESET_SALT
    )


def read_password_reset_token(token: str) -> tuple[int, str]:
    """Return (user id, password fingerprint) from a still-valid token, or
    raise PasswordResetTokenError."""
    try:
        data = signing.loads(
            token, salt=_PWRESET_SALT, max_age=settings.PASSWORD_RESET_MAX_AGE
        )
    except signing.SignatureExpired as exc:
        raise PasswordResetTokenError(
            "This password reset link has expired. Request a new one."
        ) from exc
    except signing.BadSignature as exc:
        raise PasswordResetTokenError("This password reset link is invalid.") from exc
    return data["uid"], data["pw"]


def password_reset_link(token: str) -> str:
    base = settings.FRONTEND_BASE_URL.rstrip("/")
    return f"{base}/reset-password?token={token}"


def send_password_reset_email(user) -> None:
    """Mail (or print) the password-reset link. Best-effort: a transport
    failure must not 500 the request or reveal that the address exists."""
    link = password_reset_link(make_password_reset_token(user))
    subject = "Reset your AISTP password"
    body = (
        f"Hi {user.username},\n\n"
        "We received a request to reset your AISTP password. Follow this "
        "link to choose a new one:\n\n"
        f"{link}\n\n"
        "The link expires in an hour. If you didn't ask for this, you can "
        "ignore this message -- your password won't change.\n"
    )
    send_mail(
        subject,
        body,
        settings.DEFAULT_FROM_EMAIL,
        [user.email],
        fail_silently=True,
    )
