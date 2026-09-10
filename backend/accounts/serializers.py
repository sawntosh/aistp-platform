"""
accounts/serializers.py -- FR-01: Registration & Authentication
"""
import re

from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from .models import User

USERNAME_RE = re.compile(r"^[A-Za-z]+$")
USERNAME_MIN_LENGTH = 3


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ("id", "username", "email", "role", "email_verified")


class RegisterSerializer(serializers.ModelSerializer):
    # User.email (from AbstractUser) is blank=True, so ModelSerializer would
    # make it optional -- letting a client register with NO email at all and
    # bypass the Gmail-only / uniqueness rules in validate_email(). Force it
    # required and well-formed here.
    email = serializers.EmailField(required=True)
    password = serializers.CharField(write_only=True)
    confirm_password = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ("id", "username", "email", "password", "confirm_password")

    def validate_username(self, value):
        value = value.strip()
        if not USERNAME_RE.match(value):
            raise serializers.ValidationError(
                "Username must contain letters only (A-Z, no spaces, digits or symbols)."
            )
        if len(value) < USERNAME_MIN_LENGTH:
            raise serializers.ValidationError(
                f"Username must be at least {USERNAME_MIN_LENGTH} characters."
            )
        if User.objects.filter(username__iexact=value).exists():
            raise serializers.ValidationError("That username is already taken.")
        return value

    def validate_email(self, value):
        if not value.lower().endswith("@gmail.com"):
            raise serializers.ValidationError("Only Gmail addresses are accepted (e.g. name@gmail.com).")
        local_part = value.rsplit("@", 1)[0]
        if not any(c.isalpha() for c in local_part):
            raise serializers.ValidationError(
                "The part before @gmail.com must include at least one letter (e.g. name123@gmail.com), not only numbers."
            )
        if not re.match(r"^[A-Za-z0-9.]+$", local_part):
            raise serializers.ValidationError(
                "The part before @gmail.com may only contain letters, digits and dots."
            )
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("A user with that email already exists.")
        return value

    def validate(self, attrs):
        if attrs["password"] != attrs["confirm_password"]:
            raise serializers.ValidationError({"confirm_password": "Passwords do not match."})

        # Run Django's configured AUTH_PASSWORD_VALIDATORS (min length 8,
        # common password, numeric-only, similarity to username/email, and
        # accounts.validators.ComplexityValidator -- upper/digit/symbol).
        try:
            validate_password(
                attrs["password"],
                user=User(username=attrs.get("username"), email=attrs.get("email")),
            )
        except DjangoValidationError as exc:
            raise serializers.ValidationError({"password": list(exc.messages)})

        return attrs

    def create(self, validated_data):
        validated_data.pop("confirm_password")
        password = validated_data.pop("password")
        user = User(**validated_data)
        user.set_password(password)
        # Inactive until the emailed link is followed (LoginView returns 403).
        user.email_verified = False
        user.save()
        return user


class EmailVerificationSerializer(serializers.Serializer):
    """Payload for VerifyEmailView: the address plus the 6-digit code."""
    email = serializers.EmailField()
    code = serializers.CharField()


class ResendVerificationSerializer(serializers.Serializer):
    email = serializers.EmailField()


class PasswordResetRequestSerializer(serializers.Serializer):
    email = serializers.EmailField()


class PasswordResetConfirmSerializer(serializers.Serializer):
    """Payload for PasswordResetConfirmView. The password policy
    (AUTH_PASSWORD_VALIDATORS -- length, complexity, similarity) is checked
    in the view instead, where the code has been resolved to a real user
    for the similarity comparison."""
    email = serializers.EmailField()
    code = serializers.CharField()
    password = serializers.CharField(write_only=True)
    confirm_password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        if attrs["password"] != attrs["confirm_password"]:
            raise serializers.ValidationError(
                {"confirm_password": "Passwords do not match."}
            )
        return attrs
