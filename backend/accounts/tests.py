"""
Authentication API tests -- FR-01.

Registration validation (username charset, password policy, Gmail rule,
duplicates, boundaries), email verification (block-until-verified,
verify, resend), login outcomes, per-(username, IP) lockout, and JWT
handling on the protected /me/ endpoint.
"""
from django.core import mail
from django.core.cache import cache
from django.contrib.auth import get_user_model
from django.test import override_settings
from rest_framework.test import APITestCase

from accounts.emails import make_token

User = get_user_model()

VALID = {
    "username": "alice",
    "email": "alice@gmail.com",
    "password": "Str0ngPass!23",
    "confirm_password": "Str0ngPass!23",
}


class RegistrationValidationTests(APITestCase):
    def setUp(self):
        cache.clear()
        mail.outbox = []

    def _register(self, **overrides):
        return self.client.post("/api/auth/register/", {**VALID, **overrides})

    def test_valid_registration_creates_unverified_user_and_sends_email(self):
        resp = self._register()
        self.assertEqual(resp.status_code, 201)
        user = User.objects.get(username="alice")
        self.assertFalse(user.email_verified)
        self.assertEqual(user.role, User.Role.STUDENT)
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn("verify-email?token=", mail.outbox[0].body)
        self.assertNotIn("password", resp.data)

    def test_password_is_hashed(self):
        self._register()
        user = User.objects.get(username="alice")
        self.assertNotEqual(user.password, VALID["password"])
        self.assertTrue(user.check_password(VALID["password"]))

    # -- username charset ------------------------------------------------
    def test_username_with_digits_is_rejected(self):
        resp = self._register(username="alice2")
        self.assertEqual(resp.status_code, 400)
        self.assertIn("letters only", str(resp.data["username"]).lower())

    def test_username_with_symbols_is_rejected(self):
        resp = self._register(username="al_ice")
        self.assertEqual(resp.status_code, 400)

    def test_username_with_spaces_is_rejected(self):
        resp = self._register(username="al ice")
        self.assertEqual(resp.status_code, 400)

    def test_username_shorter_than_3_is_rejected(self):
        resp = self._register(username="ab")
        self.assertEqual(resp.status_code, 400)
        self.assertIn("3 characters", str(resp.data["username"]))

    def test_username_of_exactly_3_letters_is_accepted(self):
        resp = self._register(username="abc")
        self.assertEqual(resp.status_code, 201)

    def test_leading_trailing_whitespace_in_username_is_trimmed(self):
        resp = self._register(username="  alice  ")
        self.assertEqual(resp.status_code, 201)
        self.assertTrue(User.objects.filter(username="alice").exists())

    def test_duplicate_username_is_rejected_case_insensitively(self):
        self._register()
        resp = self._register(username="ALICE", email="alice2@gmail.com")
        self.assertEqual(resp.status_code, 400)

    def test_over_long_username_is_rejected(self):
        resp = self._register(username="a" * 200)
        self.assertEqual(resp.status_code, 400)

    # -- email --------------------------------------------------------
    def test_missing_email_is_rejected(self):
        resp = self.client.post(
            "/api/auth/register/",
            {"username": "bob", "password": VALID["password"], "confirm_password": VALID["password"]},
        )
        self.assertEqual(resp.status_code, 400)
        self.assertIn("email", resp.data)

    def test_non_gmail_email_is_rejected(self):
        resp = self._register(email="alice@outlook.com")
        self.assertEqual(resp.status_code, 400)
        self.assertIn("email", resp.data)

    def test_all_numeric_email_local_part_is_rejected(self):
        resp = self._register(email="111@gmail.com")
        self.assertEqual(resp.status_code, 400)
        self.assertIn("letter", str(resp.data["email"]).lower())

    def test_email_local_part_with_a_letter_is_accepted(self):
        resp = self._register(email="name123@gmail.com")
        self.assertEqual(resp.status_code, 201)

    def test_duplicate_email_is_rejected_case_insensitively(self):
        self._register()
        resp = self._register(username="bob", email="ALICE@gmail.com")
        self.assertEqual(resp.status_code, 400)
        self.assertIn("email", resp.data)

    # -- password policy (8+ / upper / digit / symbol) -----------------
    def test_password_shorter_than_8_is_rejected(self):
        resp = self._register(password="Ab!2345", confirm_password="Ab!2345")  # 7 chars
        self.assertEqual(resp.status_code, 400)
        self.assertIn("password", resp.data)

    def test_password_exactly_8_with_all_classes_is_accepted(self):
        resp = self._register(password="Abcd!234", confirm_password="Abcd!234")
        self.assertEqual(resp.status_code, 201)

    def test_password_without_uppercase_is_rejected(self):
        resp = self._register(password="lowercase!23", confirm_password="lowercase!23")
        self.assertEqual(resp.status_code, 400)
        self.assertIn("uppercase", str(resp.data["password"]).lower())

    def test_password_without_digit_is_rejected(self):
        resp = self._register(password="NoDigitsHere!", confirm_password="NoDigitsHere!")
        self.assertEqual(resp.status_code, 400)
        self.assertIn("digit", str(resp.data["password"]).lower())

    def test_password_without_symbol_is_rejected(self):
        resp = self._register(password="NoSymbol123", confirm_password="NoSymbol123")
        self.assertEqual(resp.status_code, 400)
        self.assertIn("symbol", str(resp.data["password"]).lower())

    def test_password_confirmation_mismatch_is_rejected(self):
        resp = self._register(confirm_password="Different!23")
        self.assertEqual(resp.status_code, 400)
        self.assertIn("confirm_password", resp.data)

    def test_password_too_similar_to_username_is_rejected(self):
        resp = self._register(
            username="Thunderbird",
            password="Thunderbird1!",
            confirm_password="Thunderbird1!",
        )
        self.assertEqual(resp.status_code, 400)
        self.assertIn("password", resp.data)


class AvailabilityEndpointTests(APITestCase):
    def setUp(self):
        cache.clear()
        u = User.objects.create_user(
            username="taken", email="taken@gmail.com", password="Str0ngPass!23"
        )
        u.email_verified = True
        u.save(update_fields=["email_verified"])

    def _get(self, **params):
        return self.client.get("/api/auth/availability/", params)

    def test_free_username_and_email_report_available(self):
        resp = self._get(username="freename", email="freename@gmail.com")
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(resp.data["username_available"])
        self.assertTrue(resp.data["email_available"])

    def test_taken_username_and_email_report_unavailable_case_insensitively(self):
        resp = self._get(username="TAKEN", email="TAKEN@gmail.com")
        self.assertFalse(resp.data["username_available"])
        self.assertFalse(resp.data["email_available"])

    def test_badly_formatted_values_report_null(self):
        resp = self._get(username="ab", email="111@gmail.com")
        self.assertIsNone(resp.data["username_available"])
        self.assertIsNone(resp.data["email_available"])

    def test_omitted_params_are_absent_from_the_response(self):
        resp = self._get()
        self.assertEqual(resp.data, {})


class EmailVerificationTests(APITestCase):
    def setUp(self):
        cache.clear()
        mail.outbox = []
        self.client.post("/api/auth/register/", {**VALID})
        self.user = User.objects.get(username="alice")

    def test_valid_token_verifies_and_enables_login(self):
        token = make_token(self.user)
        resp = self.client.post("/api/auth/verify-email/", {"token": token})
        self.assertEqual(resp.status_code, 200)
        self.user.refresh_from_db()
        self.assertTrue(self.user.email_verified)

        login = self.client.post(
            "/api/auth/login/", {"username": "alice", "password": VALID["password"]}
        )
        self.assertEqual(login.status_code, 200)
        self.assertIn("access", login.data)

    def test_invalid_token_is_rejected(self):
        resp = self.client.post("/api/auth/verify-email/", {"token": "garbage"})
        self.assertEqual(resp.status_code, 400)
        self.user.refresh_from_db()
        self.assertFalse(self.user.email_verified)

    @override_settings(EMAIL_VERIFICATION_MAX_AGE=-1)
    def test_expired_token_is_rejected(self):
        resp = self.client.post("/api/auth/verify-email/", {"token": make_token(self.user)})
        self.assertEqual(resp.status_code, 400)
        self.assertIn("expired", str(resp.data["detail"]).lower())

    def test_verify_is_idempotent(self):
        token = make_token(self.user)
        self.client.post("/api/auth/verify-email/", {"token": token})
        again = self.client.post("/api/auth/verify-email/", {"token": token})
        self.assertEqual(again.status_code, 200)

    def test_resend_sends_a_fresh_link_for_unverified_account(self):
        mail.outbox = []
        resp = self.client.post("/api/auth/resend-verification/", {"email": "alice@gmail.com"})
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(mail.outbox), 1)

    def test_resend_for_unknown_email_still_returns_200_and_sends_nothing(self):
        mail.outbox = []
        resp = self.client.post("/api/auth/resend-verification/", {"email": "nobody@gmail.com"})
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(mail.outbox), 0)


class LoginGateTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.verified = User.objects.create_user(
            username="carol", email="carol@gmail.com", password="Str0ngPass!23"
        )
        self.verified.email_verified = True
        self.verified.save(update_fields=["email_verified"])
        self.unverified = User.objects.create_user(
            username="dan", email="dan@gmail.com", password="Str0ngPass!23"
        )

    def test_verified_user_with_correct_password_gets_tokens(self):
        resp = self.client.post(
            "/api/auth/login/", {"username": "carol", "password": "Str0ngPass!23"}
        )
        self.assertEqual(resp.status_code, 200)
        self.assertIn("access", resp.data)
        self.assertIn("refresh", resp.data)

    def test_unverified_user_with_correct_password_is_blocked_with_resend_hint(self):
        resp = self.client.post(
            "/api/auth/login/", {"username": "dan", "password": "Str0ngPass!23"}
        )
        self.assertEqual(resp.status_code, 403)
        self.assertTrue(resp.data["can_resend"])

    def test_wrong_password_is_rejected(self):
        resp = self.client.post(
            "/api/auth/login/", {"username": "carol", "password": "wrong-Pass!1"}
        )
        self.assertEqual(resp.status_code, 401)

    def test_unknown_user_is_rejected(self):
        resp = self.client.post(
            "/api/auth/login/", {"username": "nobody", "password": "whatever!1A"}
        )
        self.assertEqual(resp.status_code, 401)

    def test_empty_credentials_are_rejected(self):
        self.assertEqual(self.client.post("/api/auth/login/", {}).status_code, 400)


@override_settings(LOGIN_MAX_FAILURES=5, LOGIN_LOCK_SECONDS=60)
class LoginLockoutTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.user = User.objects.create_user(
            username="erin", email="erin@gmail.com", password="Str0ngPass!23"
        )
        self.user.email_verified = True
        self.user.save(update_fields=["email_verified"])

    def _bad_login(self):
        return self.client.post(
            "/api/auth/login/", {"username": "erin", "password": "wrong-Pass!1"}
        )

    def _good_login(self):
        return self.client.post(
            "/api/auth/login/", {"username": "erin", "password": "Str0ngPass!23"}
        )

    def test_fifth_consecutive_failure_locks_the_account(self):
        for _ in range(4):
            self.assertEqual(self._bad_login().status_code, 401)
        self.assertEqual(self._bad_login().status_code, 423)
        # even a correct password is refused while locked
        self.assertEqual(self._good_login().status_code, 423)

    def test_successful_login_resets_the_failure_counter(self):
        for _ in range(4):
            self._bad_login()
        self.assertEqual(self._good_login().status_code, 200)
        # counter cleared -> 4 more failures don't lock
        for _ in range(4):
            self.assertEqual(self._bad_login().status_code, 401)


class JwtProtectedEndpointTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.user = User.objects.create_user(
            username="frank", email="frank@gmail.com", password="Str0ngPass!23"
        )
        self.user.email_verified = True
        self.user.save(update_fields=["email_verified"])

    def _token(self):
        return self.client.post(
            "/api/auth/login/", {"username": "frank", "password": "Str0ngPass!23"}
        ).data["access"]

    def test_me_requires_a_token(self):
        self.assertEqual(self.client.get("/api/auth/me/").status_code, 401)

    def test_me_returns_current_user_with_valid_token(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self._token()}")
        resp = self.client.get("/api/auth/me/")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["username"], "frank")
        self.assertNotIn("password", resp.data)

    def test_malformed_token_is_rejected(self):
        self.client.credentials(HTTP_AUTHORIZATION="Bearer not.a.jwt")
        self.assertEqual(self.client.get("/api/auth/me/").status_code, 401)

    def test_empty_bearer_is_rejected(self):
        self.client.credentials(HTTP_AUTHORIZATION="Bearer ")
        self.assertEqual(self.client.get("/api/auth/me/").status_code, 401)

    def test_refresh_token_cannot_be_used_as_access_token(self):
        refresh = self.client.post(
            "/api/auth/login/", {"username": "frank", "password": "Str0ngPass!23"}
        ).data["refresh"]
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {refresh}")
        self.assertEqual(self.client.get("/api/auth/me/").status_code, 401)
