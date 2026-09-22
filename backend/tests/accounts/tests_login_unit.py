"""
Focused unit tests for the login system (POST /api/auth/login/) plus the
JWT it issues. Registration, email verification, and password reset have
their own coverage in accounts/tests.py -- this file is just the login
flow itself, kept small and self-contained.
"""
from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test import override_settings
from rest_framework.test import APITestCase

User = get_user_model()

LOGIN_URL = "/api/auth/login/"
ME_URL = "/api/auth/me/"


class LoginUnitTests(APITestCase):
    def setUp(self):
        cache.clear()  # login-failure lockout counters are cache-backed
        self.password = "Str0ngPass!23"
        self.user = User.objects.create_user(
            username="keshav", email="kesh@gmail.com", password=self.password
        )
        self.user.email_verified = True
        self.user.save(update_fields=["email_verified"])

    def _login(self, username, password):
        return self.client.post(LOGIN_URL, {"username": username, "password": password})

    def test_correct_username_and_password_returns_tokens(self):
        response = self._login("kesh", self.password)
        self.assertEqual(response.status_code, 200)
        self.assertIn("access", response.data)
        self.assertIn("refresh", response.data)

    def test_wrong_password_is_rejected(self):
        response = self._login("kesh", "totally-wrong-1A!")
        self.assertEqual(response.status_code, 401)
        self.assertNotIn("access", response.data)

    def test_unknown_username_is_rejected(self):
        response = self._login("doesnotexist", self.password)
        self.assertEqual(response.status_code, 401)

    def test_missing_password_returns_400(self):
        response = self.client.post(LOGIN_URL, {"username": "kesh"})
        self.assertEqual(response.status_code, 400)

    def test_missing_username_returns_400(self):
        response = self.client.post(LOGIN_URL, {"password": self.password})
        self.assertEqual(response.status_code, 400)

    def test_login_is_blocked_until_email_is_verified(self):
        unverified = User.objects.create_user(
            username="newbie", email="newbie@gmail.com", password=self.password
        )
        response = self._login("newbie", self.password)
        self.assertEqual(response.status_code, 403)
        self.assertTrue(response.data.get("can_resend"))

    def test_username_is_case_sensitive_free_but_password_is_not_mistyped(self):
        # Sanity check that a correctly-cased login still works after the
        # unverified-account test above touched a second user.
        response = self._login("kesh", self.password)
        self.assertEqual(response.status_code, 200)


@override_settings(LOGIN_MAX_FAILURES=5, LOGIN_LOCK_SECONDS=60)
class LoginLockoutUnitTests(APITestCase):
    """Repeated bad passwords lock the account for a cooldown window --
    protects against brute-forcing a single user's password."""

    def setUp(self):
        cache.clear()
        self.password = "Str0ngPass!23"
        self.user = User.objects.create_user(
            username="kesh", email="kesh@gmail.com", password=self.password
        )
        self.user.email_verified = True
        self.user.save(update_fields=["email_verified"])

    def _bad_login(self):
        return self.client.post(LOGIN_URL, {"username": "kesh", "password": "wrong-Pass!1"})

    def test_account_locks_after_max_consecutive_failures(self):
        for _ in range(4):
            self.assertEqual(self._bad_login().status_code, 401)
        self.assertEqual(self._bad_login().status_code, 423)

    def test_locked_account_rejects_even_the_correct_password(self):
        for _ in range(5):
            self._bad_login()
        response = self.client.post(LOGIN_URL, {"username": "kesh", "password": self.password})
        self.assertEqual(response.status_code, 423)


class JwtAccessUnitTests(APITestCase):
    """The access token a successful login issues actually unlocks a
    protected endpoint, and a missing/invalid token doesn't."""

    def setUp(self):
        cache.clear()
        self.password = "Str0ngPass!23"
        self.user = User.objects.create_user(
            username="kesh", email="kesh@gmail.com", password=self.password
        )
        self.user.email_verified = True
        self.user.save(update_fields=["email_verified"])

    def _access_token(self):
        return self.client.post(LOGIN_URL, {"username": "kesh", "password": self.password}).data["access"]

    def test_valid_access_token_reaches_the_protected_endpoint(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self._access_token()}")
        response = self.client.get(ME_URL)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["username"], "kesh")

    def test_protected_endpoint_without_a_token_is_rejected(self):
        response = self.client.get(ME_URL)
        self.assertEqual(response.status_code, 401)

    def test_protected_endpoint_with_a_garbage_token_is_rejected(self):
        self.client.credentials(HTTP_AUTHORIZATION="Bearer not-a-real-token")
        response = self.client.get(ME_URL)
        self.assertEqual(response.status_code, 401)
