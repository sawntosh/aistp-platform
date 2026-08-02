"""
accounts/models.py
See report Section 4.7 (Database Design) -- Users table.
Password hashing via Django's built-in hasher (bcrypt configured in
settings.PASSWORD_HASHERS) satisfies NFR-01 / T-01 countermeasures.
"""
from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    class Role(models.TextChoices):
        STUDENT = "student", "Student"
        ADMIN = "admin", "Admin"

    role = models.CharField(
        max_length=20, choices=Role.choices, default=Role.STUDENT
    )

    def __str__(self):
        return f"{self.username} ({self.role})"
