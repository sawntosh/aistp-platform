"""
accounts/emails.py -- email-verification token + delivery.

The token is a stateless django.core.signing token (no extra table): it
carries the user id, is signed with SECRET_KEY, and expires after
settings.EMAIL_VERIFICATION_MAX_AGE. "Resend" just mints a new one.
"""
from django.conf import settings
from django.core import signing
from django.core.mail import send_mail

_SALT = "accounts.email-verify"


class VerificationTokenError(Exception):
    """Invalid, tampered, or expired verification token."""


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
