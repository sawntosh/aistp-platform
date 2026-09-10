"""
One-off helper: turn the downloaded OAuth "Desktop app" client_secret JSON
into a Gmail API refresh token for sending mail.

Run it once, locally, on the machine where you can open a browser:

    python backend/scripts/gmail_oauth_setup.py "C:/Users/chapa/Downloads/client_secret_XXX.json"

It opens a browser, you log in as the SENDER Gmail account and click
"Allow", and it prints a ready-to-paste block for backend/.env
(GMAIL_OAUTH_CLIENT_ID / _SECRET / _REFRESH_TOKEN).

Stdlib only -- no extra pip installs needed to run this script.
The refresh token does not expire once the OAuth app is published
(in "Testing" it lasts ~7 days, then re-run this).
"""
import json
import secrets
import sys
import urllib.parse
import urllib.request
import webbrowser
from http.server import BaseHTTPRequestHandler, HTTPServer

SCOPE = "https://www.googleapis.com/auth/gmail.send"
# Loopback port. A "Desktop app" client accepts http://localhost on any port.
PORT = 8765
REDIRECT_URI = f"http://localhost:{PORT}/"


def load_client(path):
    with open(path, "r", encoding="utf-8") as fh:
        data = json.load(fh)
    block = data.get("installed") or data.get("web")
    if not block:
        sys.exit("That JSON has no 'installed'/'web' block -- is it the OAuth client file?")
    return block


def build_auth_url(client_id, state):
    params = {
        "client_id": client_id,
        "redirect_uri": REDIRECT_URI,
        "response_type": "code",
        "scope": SCOPE,
        "access_type": "offline",   # <- required to get a refresh token
        "prompt": "consent",        # <- force a refresh token every run
        "state": state,
    }
    return "https://accounts.google.com/o/oauth2/v2/auth?" + urllib.parse.urlencode(params)


class _Catcher(BaseHTTPRequestHandler):
    code = None
    state = None

    def do_GET(self):  # noqa: N802 (stdlib naming)
        query = urllib.parse.urlparse(self.path).query
        params = urllib.parse.parse_qs(query)
        _Catcher.code = (params.get("code") or [None])[0]
        _Catcher.state = (params.get("state") or [None])[0]
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.end_headers()
        ok = _Catcher.code is not None
        msg = "Authorised. You can close this tab and return to the terminal." if ok \
            else f"Authorisation failed: {params.get('error', ['unknown'])[0]}"
        self.wfile.write(f"<html><body style='font-family:sans-serif'><h3>{msg}</h3></body></html>".encode())

    def log_message(self, *_):  # silence the default request logging
        pass


def exchange_code(block, code):
    body = urllib.parse.urlencode({
        "code": code,
        "client_id": block["client_id"],
        "client_secret": block["client_secret"],
        "redirect_uri": REDIRECT_URI,
        "grant_type": "authorization_code",
    }).encode()
    req = urllib.request.Request(
        block.get("token_uri", "https://oauth2.googleapis.com/token"),
        data=body,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    with urllib.request.urlopen(req) as resp:
        return json.load(resp)


def main():
    if len(sys.argv) < 2:
        sys.exit('Usage: python backend/scripts/gmail_oauth_setup.py "<path to client_secret_*.json>"')
    block = load_client(sys.argv[1])
    state = secrets.token_urlsafe(16)

    url = build_auth_url(block["client_id"], state)
    print("\nOpening your browser to authorise. If it doesn't open, paste this URL:\n")
    print(url, "\n")
    webbrowser.open(url)

    server = HTTPServer(("localhost", PORT), _Catcher)
    print(f"Waiting for the redirect on {REDIRECT_URI} ...")
    server.handle_request()  # serve exactly one request, then stop

    if not _Catcher.code:
        sys.exit("No authorisation code received. Re-run and make sure you click Allow.")
    if _Catcher.state != state:
        sys.exit("State mismatch -- aborting for safety. Re-run.")

    tokens = exchange_code(block, _Catcher.code)
    refresh = tokens.get("refresh_token")
    if not refresh:
        sys.exit("Google returned no refresh_token. Revoke the app's access at "
                 "https://myaccount.google.com/permissions and re-run (prompt=consent is set).")

    print("\n" + "=" * 68)
    print("SUCCESS -- paste this into backend/.env :")
    print("=" * 68)
    print("EMAIL_PROVIDER=gmail_api")
    print(f"GMAIL_OAUTH_CLIENT_ID={block['client_id']}")
    print(f"GMAIL_OAUTH_CLIENT_SECRET={block['client_secret']}")
    print(f"GMAIL_OAUTH_REFRESH_TOKEN={refresh}")
    print("GMAIL_SENDER=<the Gmail address you just logged in as>")
    print("DEFAULT_FROM_EMAIL=AISTP <the same Gmail address>")
    print("=" * 68)


if __name__ == "__main__":
    main()
