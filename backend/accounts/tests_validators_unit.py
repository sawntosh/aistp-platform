"""
Unit tests for accounts/validators.py's ComplexityValidator, isolated from
the registration endpoint. RegistrationValidationTests in tests.py already
covers the rule end-to-end via the API; these pin down the validator's own
pass/fail logic and error contents directly.
"""
from django.core.exceptions import ValidationError
from django.test import SimpleTestCase

from accounts.validators import ComplexityValidator


class ComplexityValidatorUnitTests(SimpleTestCase):
    def setUp(self):
        self.validator = ComplexityValidator()

    def test_password_with_upper_digit_and_symbol_passes(self):
        self.validator.validate("Str0ng!Pass")  # should not raise

    def test_missing_uppercase_is_rejected(self):
        with self.assertRaises(ValidationError) as ctx:
            self.validator.validate("str0ng!pass")
        self.assertIn("uppercase letter", str(ctx.exception))

    def test_missing_digit_is_rejected(self):
        with self.assertRaises(ValidationError) as ctx:
            self.validator.validate("Strong!Pass")
        self.assertIn("digit", str(ctx.exception))

    def test_missing_symbol_is_rejected(self):
        with self.assertRaises(ValidationError) as ctx:
            self.validator.validate("Str0ngPass")
        self.assertIn("symbol", str(ctx.exception))

    def test_all_three_missing_lists_all_three_reasons(self):
        with self.assertRaises(ValidationError) as ctx:
            self.validator.validate("plainpassword")
        message = str(ctx.exception)
        self.assertIn("uppercase letter", message)
        self.assertIn("digit", message)
        self.assertIn("symbol", message)

    def test_get_help_text_mentions_all_three_requirements(self):
        help_text = self.validator.get_help_text()
        self.assertIn("uppercase", help_text)
        self.assertIn("digit", help_text)
        self.assertIn("symbol", help_text)
