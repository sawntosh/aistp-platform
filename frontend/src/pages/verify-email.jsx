import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { MailCheck, ShieldCheck } from "lucide-react";
import { verifyEmail, resendVerification } from "../services/authService";
import { getErrorMessage } from "../services/apiClient";
import Input, { Label } from "../components/ui/Input";
import Button from "../components/ui/Button";

const GMAIL_REGEX = /^(?=[A-Za-z0-9.]*[A-Za-z])[A-Za-z0-9.]+@gmail\.com$/i;
const RESEND_COOLDOWN_SECONDS = 60;

export default function VerifyEmailPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [errorKey, setErrorKey] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [resendNote, setResendNote] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const prefilled = useRef(false);

  // Prefill the address from ?email= (set by the register redirect).
  useEffect(() => {
    if (!router.isReady || prefilled.current) return;
    prefilled.current = true;
    const q = router.query.email;
    if (typeof q === "string") setEmail(q);
  }, [router.isReady, router.query.email]);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const t = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const trimmedEmail = email.trim();
  const emailValid = GMAIL_REGEX.test(trimmedEmail);
  const codeValid = /^\d{6}$/.test(code);

  function showError(message) {
    setError(message);
    setErrorKey((k) => k + 1);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!emailValid) {
      showError("Enter the Gmail address you registered with.");
      return;
    }
    if (!codeValid) {
      showError("Enter the 6-digit code from your email.");
      return;
    }
    setIsSubmitting(true);
    try {
      await verifyEmail({ email: trimmedEmail, code });
      setDone(true);
    } catch (err) {
      showError(
        getErrorMessage(err, "That code is incorrect or has expired.")
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleResend() {
    setResendNote("");
    setError("");
    if (!emailValid) {
      showError("Enter the Gmail address you registered with first.");
      return;
    }
    setCooldown(RESEND_COOLDOWN_SECONDS);
    try {
      await resendVerification(trimmedEmail);
      setResendNote("If that email still needs verifying, a new code is on its way.");
    } catch {
      setResendNote("Couldn't send right now. Try again in a moment.");
    }
  }

  const shell = (children) => (
    <div className="relative flex min-h-screen w-full items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-sm rounded-lg border border-border bg-surface p-8 shadow-sm">
        {children}
      </div>
    </div>
  );

  if (done) {
    return shell(
      <div className="text-center">
        <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-success-muted text-success">
          <ShieldCheck className="h-6 w-6" aria-hidden="true" />
        </span>
        <h1 className="text-h1 text-text-primary">Email verified</h1>
        <p className="mt-2 text-body-sm text-text-muted">
          Your account is active. Log in to get started.
        </p>
        <Button href="/login?verified=1" size="lg" className="mt-6 w-full">
          Log in
        </Button>
      </div>
    );
  }

  return shell(
    <>
      <div className="mb-6 flex flex-col items-center text-center">
        <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary-muted text-primary">
          <MailCheck className="h-6 w-6" aria-hidden="true" />
        </span>
        <h1 className="text-h1 text-text-primary">Verify your email</h1>
        <p className="mt-1 text-body-sm text-text-muted">
          Enter the 6-digit code we emailed you. It expires in 10 minutes.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="name123@gmail.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div>
          <Label htmlFor="code">Verification code</Label>
          <Input
            id="code"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="123456"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          />
        </div>

        {error && (
          <p key={errorKey} role="alert" className="text-body-sm text-error animate-fade-in">
            {error}
          </p>
        )}

        <Button
          type="submit"
          size="lg"
          isLoading={isSubmitting}
          disabled={isSubmitting || !emailValid || !codeValid}
          className="w-full"
        >
          {isSubmitting ? "Verifying…" : "Verify email"}
        </Button>
      </form>

      <div className="mt-4 text-center">
        <button
          type="button"
          onClick={handleResend}
          disabled={cooldown > 0}
          className="text-body-sm font-medium text-primary hover:underline disabled:opacity-50 disabled:no-underline"
        >
          {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
        </button>
        {resendNote && (
          <p className="mt-1 text-caption text-text-muted animate-fade-in">{resendNote}</p>
        )}
      </div>

      <p className="mt-4 text-center text-body-sm text-text-muted">
        <Link href="/login" className="font-medium text-primary hover:underline">
          Back to login
        </Link>
      </p>
    </>
  );
}
