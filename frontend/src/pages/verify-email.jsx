import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { MailCheck, MailX, Loader2 } from "lucide-react";
import { verifyEmail, resendVerification } from "../services/authService";
import { getErrorMessage } from "../services/apiClient";
import Input, { Label } from "../components/ui/Input";
import Button from "../components/ui/Button";

export default function VerifyEmailPage() {
  const router = useRouter();
  const [status, setStatus] = useState("pending"); // pending | ok | error
  const [message, setMessage] = useState("");
  const [resendEmail, setResendEmail] = useState("");
  const [resendNote, setResendNote] = useState("");
  const ran = useRef(false);

  useEffect(() => {
    if (!router.isReady || ran.current) return;
    ran.current = true;

    const token = router.query.token;
    if (!token || typeof token !== "string") {
      setStatus("error");
      setMessage("This link is missing its verification token.");
      return;
    }
    (async () => {
      try {
        const data = await verifyEmail(token);
        setStatus("ok");
        setMessage(data?.detail || "Email verified. You can now log in.");
      } catch (err) {
        setStatus("error");
        setMessage(getErrorMessage(err, "This verification link is invalid or has expired."));
      }
    })();
  }, [router.isReady, router.query.token]);

  async function handleResend(e) {
    e.preventDefault();
    setResendNote("");
    try {
      await resendVerification(resendEmail);
      setResendNote("If that email still needs verifying, a new link is on its way.");
    } catch {
      setResendNote("Couldn't send right now. Try again in a moment.");
    }
  }

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-sm rounded-lg border border-border bg-surface p-8 text-center shadow-sm">
        {status === "pending" && (
          <>
            <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-surface-muted text-text-muted">
              <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
            </span>
            <h1 className="text-h1 text-text-primary">Verifying…</h1>
          </>
        )}

        {status === "ok" && (
          <>
            <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-success-muted text-success">
              <MailCheck className="h-6 w-6" aria-hidden="true" />
            </span>
            <h1 className="text-h1 text-text-primary">Email verified</h1>
            <p className="mt-2 text-body-sm text-text-muted">{message}</p>
            <Button href="/login" size="lg" className="mt-6 w-full">Log in</Button>
          </>
        )}

        {status === "error" && (
          <>
            <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-error-muted text-error">
              <MailX className="h-6 w-6" aria-hidden="true" />
            </span>
            <h1 className="text-h1 text-text-primary">Link didn&apos;t work</h1>
            <p className="mt-2 text-body-sm text-text-muted">{message}</p>

            <form onSubmit={handleResend} className="mt-6 space-y-3 text-left">
              <div>
                <Label htmlFor="resendEmail">Send a new link</Label>
                <Input
                  id="resendEmail"
                  type="email"
                  required
                  placeholder="name@gmail.com"
                  value={resendEmail}
                  onChange={(e) => setResendEmail(e.target.value)}
                />
              </div>
              <Button type="submit" size="lg" className="w-full">Resend verification email</Button>
              {resendNote && <p className="text-caption text-text-muted">{resendNote}</p>}
            </form>

            <p className="mt-4 text-body-sm text-text-muted">
              <Link href="/login" className="font-medium text-primary hover:underline">Back to login</Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
