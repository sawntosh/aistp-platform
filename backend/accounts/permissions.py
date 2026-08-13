"""
accounts/permissions.py -- FR-06: restrict admin-only endpoints
(question CRUD, etc.) to users with role == User.Role.ADMIN.
"""
from rest_framework import permissions

from .models import User


class IsAdminRole(permissions.BasePermission):
    """Allows access only to authenticated users with role == 'admin'."""

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.role == User.Role.ADMIN
        )
