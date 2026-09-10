"""
accounts/gmail_backend.py -- a Django email backend that delivers through
the Gmail API (users.messages.send) authenticated with an OAuth2 refresh
token, instead of SMTP.

Selected by EMAIL_PROVIDER=gmail_api. Reads four settings, all sourced
from the environment:

    GMAIL_OAUTH_CLIENT_ID
    GMAIL_OAUTH_CLIENT_SECRET
    GMAIL_OAUTH_REFRESH_TOKEN   (one-off: backend/scripts/gmail_oauth_setup.py)
    GMAIL_SENDER                (the authorised Gmail address)

send_messages() honours fail_silently the same way the SMTP backend does,
so a transport error never turns a registration into a 500.
"""
import base64

from django.conf import settings
from django.core.mail.backends.base import BaseEmailBackend

TOKEN_URI = "https://oauth2.googleapis.com/token"
SEND_SCOPE = "https://www.googleapis.com/auth/gmail.send"
REQUIRED_SETTINGS = (
    "GMAIL_OAUTH_CLIENT_ID",
    "GMAIL_OAUTH_CLIENT_SECRET",
    "GMAIL_OAUTH_REFRESH_TOKEN",
    "GMAIL_SENDER",
)


class GmailAPIEmailBackend(BaseEmailBackend):
    def __init__(self, fail_silently=False, **kwargs):
        super().__init__(fail_silently=fail_silently, **kwargs)
        self._service = None

    def _get_service(self):
        if self._service is not None:
            return self._service

        missing = [n for n in REQUIRED_SETTINGS if not getattr(settings, n, "")]
        if missing:
            raise RuntimeError(
                "EMAIL_PROVIDER=gmail_api but these settings are unset: "
                + ", ".join(missing)
            )

        # Imported lazily so the dependency is only needed when this backend
        # is actually selected (dev/CI default to the console backend).
        from google.oauth2.credentials import Credentials
        from googleapiclient.discovery import build

        creds = Credentials(
            token=None,
            refresh_token=settings.GMAIL_OAUTH_REFRESH_TOKEN,
            client_id=settings.GMAIL_OAUTH_CLIENT_ID,
            client_secret=settings.GMAIL_OAUTH_CLIENT_SECRET,
            token_uri=TOKEN_URI,
            scopes=[SEND_SCOPE],
        )
        self._service = build(
            "gmail", "v1", credentials=creds, cache_discovery=False
        )
        return self._service

    def send_messages(self, email_messages):
        if not email_messages:
            return 0

        try:
            service = self._get_service()
        except Exception:
            if not self.fail_silently:
                raise
            return 0

        sent = 0
        for message in email_messages:
            try:
                mime = message.message()
                if not mime["From"]:
                    mime["From"] = settings.GMAIL_SENDER
                raw = base64.urlsafe_b64encode(mime.as_bytes()).decode()
                service.users().messages().send(
                    userId="me", body={"raw": raw}
                ).execute()
                sent += 1
            except Exception:
                if not self.fail_silently:
                    raise
        return sent
