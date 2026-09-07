"""
accounts/views.py -- FR-01: Registration & Authentication

Register hashes the password (bcrypt hasher) and activates the account
immediately -- email verification is not required to sign up or log in.
The verify-email / resend endpoints still exist (dormant) so the gate can
be switched back on later. Login issues a JWT via SimpleJWT and is
protected by a per-(username, IP) lockout on top of the scoped rate
throttle.
"""
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView

from . import lockout
from .emails import (
    PasswordResetTokenError,
    VerificationTokenError,
    password_fingerprint,
    read_password_reset_token,
    read_token,
    send_password_reset_email,
    send_verification_email,
)
from .serializers import (
    USERNAME_MIN_LENGTH,
    USERNAME_RE,
    EmailVerificationSerializer,
    PasswordResetConfirmSerializer,
    PasswordResetRequestSerializer,
    RegisterSerializer,
    ResendVerificationSerializer,
    UserSerializer,
)

User = get_user_model()


def _locked_message(ident):
    return (
        "Too many failed login attempts. This account is temporarily locked "
        f"for {lockout.seconds_remaining(ident)} seconds."
    )


class RegisterView(generics.CreateAPIView):
    """FR-01: create a new student account, active immediately. Issues no
    tokens -- the client logs in separately.

    Rate-limited (throttle_scope="register") so the open, unauthenticated
    endpoint can't be used to mass-create accounts / fill the users table.
    """
    permission_classes = [permissions.AllowAny]
    throttle_scope = "register"
    queryset = User.objects.all()
    serializer_class = RegisterSerializer

    def perform_create(self, serializer):
        # Email verification is not required to sign up: mark the account
        # verified so nothing downstream gates on it. The verify-email
        # flow still exists (dormant) if this is switched back on.
        user = serializer.save()
        user.email_verified = True
        user.save(update_fields=["email_verified"])


class LoginView(TokenObtainPairView):
    """Rate-limited (throttle_scope="login") + per-(username, IP) lockout.

    - locked pair     -> 423 Locked
    - bad credentials -> 401 (counts toward the lockout)
    - correct         -> 200 with access/refresh (no email-verification gate)
    """
    throttle_scope = "login"

    def post(self, request, *args, **kwargs):
        ident = lockout.identity(request.data.get("username"), request)

        if lockout.is_locked(ident):
            return Response(
                {"detail": _locked_message(ident)}, status=status.HTTP_423_LOCKED
            )

        serializer = self.get_serializer(data=request.data)
        try:
            serializer.is_valid(raise_exception=True)
        except Exception:
            lockout.register_failure(ident)
            # If this failure is the one that tripped the threshold, tell
            # the caller it's now locked rather than returning a bare 401.
            if lockout.is_locked(ident):
                return Response(
                    {"detail": _locked_message(ident)}, status=status.HTTP_423_LOCKED
                )
            raise

        # Credentials are correct -- clear the failure counter.
        lockout.clear(ident)

        return Response(serializer.validated_data, status=status.HTTP_200_OK)


class VerifyEmailView(APIView):
    """POST {token} from the emailed link -> marks the account verified.
    Idempotent: a second call for an already-verified account still 200s."""
    permission_classes = [permissions.AllowAny]
    throttle_scope = "register"

    def post(self, request):
        serializer = EmailVerificationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            uid = read_token(serializer.validated_data["token"])
        except VerificationTokenError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        user = User.objects.filter(pk=uid).first()
        if user is None:
            return Response(
                {"detail": "This verification link is invalid."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not user.email_verified:
            user.email_verified = True
            user.save(update_fields=["email_verified"])
        return Response({"detail": "Email verified. You can now log in."})


class ResendVerificationView(APIView):
    """POST {email} -> re-sends the link if that address maps to an
    unverified account. Always 200 (never reveals whether an email is
    registered)."""
    permission_classes = [permissions.AllowAny]
    throttle_scope = "register"

    def post(self, request):
        serializer = ResendVerificationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = User.objects.filter(
            email__iexact=serializer.validated_data["email"], email_verified=False
        ).first()
        if user is not None:
            send_verification_email(user)
        return Response(
            {"detail": "If that email needs verification, a new link is on its way."}
        )


class PasswordResetRequestView(APIView):
    """POST {email} -> mails a reset link if that address maps to an
    account. Always 200 (never reveals whether an email is registered).

    Rate-limited under the "register" scope like the other open, unauth'd
    account endpoints."""
    permission_classes = [permissions.AllowAny]
    throttle_scope = "register"

    def post(self, request):
        serializer = PasswordResetRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = User.objects.filter(
            email__iexact=serializer.validated_data["email"]
        ).first()
        if user is not None:
            send_password_reset_email(user)
        return Response(
            {
                "detail": "If an account exists for that email, a password "
                "reset link is on its way."
            }
        )


class PasswordResetConfirmView(APIView):
    """POST {token, password, confirm_password} from the emailed link ->
    sets the new password. The token is single-use: it carries a
    fingerprint of the old password hash, so once the password changes the
    same link (and any older ones) stop working."""
    permission_classes = [permissions.AllowAny]
    throttle_scope = "register"

    def post(self, request):
        serializer = PasswordResetConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            uid, fingerprint = read_password_reset_token(
                serializer.validated_data["token"]
            )
        except PasswordResetTokenError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        user = User.objects.filter(pk=uid).first()
        if user is None or password_fingerprint(user) != fingerprint:
            return Response(
                {
                    "detail": "This password reset link is invalid or has "
                    "already been used."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        password = serializer.validated_data["password"]
        try:
            validate_password(password, user=user)
        except DjangoValidationError as exc:
            return Response(
                {"password": list(exc.messages)}, status=status.HTTP_400_BAD_REQUEST
            )

        user.set_password(password)
        user.save(update_fields=["password"])
        # A successful reset also clears any standing login lockout for this
        # user so they aren't locked out right after regaining access.
        lockout.clear(lockout.identity(user.username, request))
        return Response(
            {"detail": "Your password has been reset. You can now log in."}
        )


class AvailabilityView(APIView):
    """GET ?username=&email= -> {"username_available": bool|null,
    "email_available": bool|null} for the register form's live check.
    null means the value wasn't supplied or isn't a valid format yet, so
    there's nothing to look up. Same information registration already
    reveals on submit; throttled under the "register" scope."""
    permission_classes = [permissions.AllowAny]
    throttle_scope = "availability"

    def get(self, request):
        out = {}

        username = (request.query_params.get("username") or "").strip()
        if username:
            valid = bool(USERNAME_RE.match(username)) and len(username) >= USERNAME_MIN_LENGTH
            out["username_available"] = (
                not User.objects.filter(username__iexact=username).exists() if valid else None
            )

        email = (request.query_params.get("email") or "").strip()
        if email:
            local = email.rsplit("@", 1)[0]
            valid = email.lower().endswith("@gmail.com") and any(c.isalpha() for c in local)
            out["email_available"] = (
                not User.objects.filter(email__iexact=email).exists() if valid else None
            )

        return Response(out)


class MeView(generics.RetrieveAPIView):
    """Returns the authenticated user; called by the frontend right after
    login and on session restore."""
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = UserSerializer

    def get_object(self):
        return self.request.user
