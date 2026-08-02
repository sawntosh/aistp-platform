"""
accounts/views.py -- FR-01: Registration & Authentication
Login issues a JWT via SimpleJWT; register hashes the password via
Django's built-in auth (bcrypt hasher configured in settings).
"""
from rest_framework import generics, permissions
from rest_framework_simplejwt.views import TokenObtainPairView

from .models import User
from .serializers import RegisterSerializer


class RegisterView(generics.CreateAPIView):
    """FR-01: create a new student account. Issues no tokens -- the
    client logs in separately afterwards."""
    permission_classes = [permissions.AllowAny]
    queryset = User.objects.all()
    serializer_class = RegisterSerializer


class LoginView(TokenObtainPairView):
    """Rate-limited login endpoint (T-01/T-09 countermeasure).
    throttle_scope = "login" maps to REST_FRAMEWORK.DEFAULT_THROTTLE_RATES.
    """
    throttle_scope = "login"
