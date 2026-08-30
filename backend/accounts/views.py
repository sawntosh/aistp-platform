"""
accounts/views.py -- FR-01: Registration & Authentication

Register hashes the password (bcrypt hasher) and mails a verification
link. Login issues a JWT via SimpleJWT, but only once the email is
verified, and is protected by a per-(username, IP) lockout on top of the
scoped rate throttle.
"""
from django.contrib.auth import get_user_model
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView

from . import lockout
from .emails import VerificationTokenError, read_token, send_verification_email
from .serializers import (
    USERNAME_MIN_LENGTH,
    USERNAME_RE,
    EmailVerificationSerializer,
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
    """FR-01: create a new student account and mail a verification link.
    Issues no tokens -- the client verifies, then logs in separately.

    Rate-limited (throttle_scope="register") so the open, unauthenticated
    endpoint can't be used to mass-create accounts / fill the users table.
    """
    permission_classes = [permissions.AllowAny]
    throttle_scope = "register"
    queryset = User.objects.all()
    serializer_class = RegisterSerializer

    def perform_create(self, serializer):
        user = serializer.save()
        send_verification_email(user)


class LoginView(TokenObtainPairView):
    """Rate-limited (throttle_scope="login") + per-(username, IP) lockout.

    - locked pair          -> 423 Locked
    - bad credentials      -> 401 (counts toward the lockout)
    - correct but unverified-> 403 with {"can_resend": true} (does NOT count)
    - correct + verified   -> 200 with access/refresh
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

        # Credentials are correct -- clear the failure counter regardless of
        # verification state.
        lockout.clear(ident)

        user = serializer.user
        if not user.email_verified:
            return Response(
                {
                    "detail": "Please verify your email address before logging in.",
                    "can_resend": True,
                },
                status=status.HTTP_403_FORBIDDEN,
            )

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
