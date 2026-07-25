"""
accounts/views.py -- FR-01: Registration & Authentication
Login issues a JWT via SimpleJWT; register hashes the password via
Django's built-in auth (bcrypt hasher configured in settings).
"""
from rest_framework import generics, permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView


class RegisterView(generics.CreateAPIView):
    """TODO: implement RegisterSerializer (email, password, confirm password)."""
    permission_classes = [permissions.AllowAny]

    def post(self, request, *args, **kwargs):
        raise NotImplementedError


class LoginView(TokenObtainPairView):
    """Rate-limited login endpoint (T-01/T-09 countermeasure).
    throttle_scope = "login" maps to REST_FRAMEWORK.DEFAULT_THROTTLE_RATES.
    """
    throttle_scope = "login"
