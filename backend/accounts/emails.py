"""
accounts/emails.py -- 6-digit one-time codes for email verification and
password reset, plus their delivery.

A code is a random 6-digit string. Only an HMAC-SHA256 of it (keyed with
SECRET_KEY) is stored, in accounts.models.EmailOTP; the raw value exists
only long enough to put in the outgoing email. "Resend" mints a new code
and invalidates the previous one.

Delivery goes through django.core.mail.send_mail, so the transport is
whatever settings.EMAIL_BACKEND resolves to (console in dev, the Gmail
API backend when EMAIL_PROVIDER=gmail_api). Sending is best-effort:
a mail-transport failure must not 500 registration or reveal whether an
address is registered.
"""
import hashlib
import hmac
import secrets

from django.conf import settings
from django.core.mail import send_mail
from django.utils import timezone

from .models import EmailOTP

CODE_LENGTH = 6


class OTPError(Exception):
    """Code is missing, wrong, expired, or has had too many attempts."""


def _hash_code(raw: str) -> str:
    return hmac.new(
        settings.SECRET_KEY.encode(), raw.encode(), hashlib.sha256
    ).hexdigest()


def _new_code() -> str:
    return f"{secrets.randbelow(10 ** CODE_LENGTH):0{CODE_LENGTH}d}"


def issue_code(user, purpose: str) -> str:
    """Consume any outstanding code for (user, purpose), store a fresh one,
    and return the raw code so the caller can mail it."""
    EmailOTP.objects.filter(
        user=user, purpose=purpose, consumed_at__isnull=True
    ).update(consumed_at=timezone.now())
    raw = _new_code()
    EmailOTP.objects.create(user=user, purpose=purpose, code_hash=_hash_code(raw))
    return raw


def verify_code(user, purpose: str, raw: str) -> None:
    """Check ``raw`` against the newest outstanding code for (user, purpose).

    On success the code is consumed. On a wrong guess the attempt counter
    is bumped (and the code burned once it hits the cap). Raises OTPError
    on any non-match.
    """
    otp = (
        EmailOTP.objects.filter(
            user=user, purpose=purpose, consumed_at__isnull=True
        )
        .order_by("-created_at")
        .first()
    )
    if otp is None:
        raise OTPError("No code is pending for this account. Request a new one.")
    if otp.is_expired():
        otp.consumed_at = timezone.now()
        otp.save(update_fields=["consumed_at"])
        raise OTPError("This code has expired. Request a new one.")
    if otp.attempts >= settings.EMAIL_OTP_MAX_ATTEMPTS:
        otp.consumed_at = timezone.now()
        otp.save(update_fields=["consumed_at"])
        raise OTPError("Too many incorrect attempts. Request a new code.")
    if not hmac.compare_digest(otp.code_hash, _hash_code(raw or "")):
        otp.attempts += 1
        otp.save(update_fields=["attempts"])
        raise OTPError("That code is incorrect.")
    otp.consumed_at = timezone.now()
    otp.save(update_fields=["consumed_at"])


def can_resend(user, purpose: str) -> bool:
    """False if a code for (user, purpose) was issued within the last
    settings.EMAIL_OTP_RESEND_COOLDOWN seconds -- stops the resend button
    being used to flood someone's inbox."""
    latest = (
        EmailOTP.objects.filter(user=user, purpose=purpose)
        .order_by("-created_at")
        .first()
    )
    if latest is None:
        return True
    age = (timezone.now() - latest.created_at).total_seconds()
    return age >= settings.EMAIL_OTP_RESEND_COOLDOWN


def _minutes() -> int:
    return max(1, settings.EMAIL_OTP_MAX_AGE // 60)


def _send(user, subject: str, body: str) -> None:
    send_mail(
        subject,
        body,
        settings.DEFAULT_FROM_EMAIL,
        [user.email],
        fail_silently=True,
    )


def send_verification_code(user) -> None:
    code = issue_code(user, EmailOTP.Purpose.VERIFY_EMAIL)
    _send(
        user,
        "Your AISTP verification code",
        f"Hi {user.username},\n\n"
        "Enter this code to activate your AISTP account:\n\n"
        f"    {code}\n\n"
        f"The code expires in {_minutes()} minutes. If you didn't create "
        "this account, you can ignore this message.\n",
    )


def send_password_reset_code(user) -> None:
    code = issue_code(user, EmailOTP.Purpose.PASSWORD_RESET)
    _send(
        user,
        "Your AISTP password reset code",
        f"Hi {user.username},\n\n"
        "Use this code to reset your AISTP password:\n\n"
        f"    {code}\n\n"
        f"The code expires in {_minutes()} minutes. If you didn't ask for "
        "this, you can ignore this message -- your password won't change.\n",
    )
