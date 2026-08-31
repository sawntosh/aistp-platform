"""
accounts/validators.py -- custom AUTH_PASSWORD_VALIDATORS.

Backend enforcement of the same rules the register form's strength meter
shows, so the policy can't be bypassed by calling the API directly:
8+ characters, at least one uppercase letter, one digit, one symbol.
"""
import re

from django.core.exceptions import ValidationError
from django.utils.translation import gettext as _

SYMBOL_RE = re.compile(r"[^A-Za-z0-9]")


class ComplexityValidator:
    """Requires an uppercase letter, a digit and a non-alphanumeric symbol.
    (Length is handled separately by MinimumLengthValidator.)"""

    def validate(self, password, user=None):
        errors = []
        if not any(c.isupper() for c in password):
            errors.append(_("at least one uppercase letter"))
        if not any(c.isdigit() for c in password):
            errors.append(_("at least one digit"))
        if not SYMBOL_RE.search(password):
            errors.append(_("at least one symbol (e.g. ! ? @ #)"))
        if errors:
            raise ValidationError(
                _("Password must contain %(missing)s.") % {"missing": ", ".join(errors)},
                code="password_not_complex",
            )

    def get_help_text(self):
        return _(
            "Your password must contain at least one uppercase letter, one digit and one symbol."
        )
