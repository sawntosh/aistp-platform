import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { Check, KeyRound, ShieldCheck } from "lucide-react";
import { confirmPasswordReset, requestPasswordReset } from "../services/authService";
import { getErrorMessage } from "../services/apiClient";
import PasswordInput from "../components/PasswordInput";
import Input, { Label } from "../components/ui/Input";
import Button from "../components/ui/Button";
import { cn } from "../lib/cn";

const STRENGTH_LEVELS = [
  { label: "Too short", tone: "bg-border-strong" },
  { label: "Weak", tone: "bg-error" },
  { label: "Fair", tone: "bg-warning" },
  { label: "Good", tone: "bg-info" },
  { label: "Strong", tone: "bg-success" },
];

const MIN_PASSWORD_LENGTH = 8;
const GMAIL_REGEX = /^(?=[A-Za-z0-9.]*[A-Za-z])[A-Za-z0-9.]+@gmail\.com$/i;
const RESEND_COOLDOWN_SECONDS = 60;

function getPasswordStrength(password) {
  if (!password) return null;
  let score = password.length >= MIN_PASSWORD_LENGTH ? 1 : 0;
  if (password.length >= MIN_PASSWORD_LENGTH) {
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;
  }
  return { score, ...STRENGTH_LEVELS[score] };
}

// Mirrors the backend policy (accounts.validators.ComplexityValidator +
// MinimumLengthValidator): 8+ chars, one uppercase, one digit, one symbol.
function passwordPolicyError(password) {
  if (!password) return "";
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  const missing = [];
  if (!/[A-Z]/.test(password)) missing.push("an uppercase letter");
  if (!/[0-9]/.test(password)) missing.push("a digit");
  if (!/[^A-Za-z0-9]/.test(password)) missing.push("a symbol");
  if (missing.length) return `Password needs ${missing.join(", ")}.`;
  return "";
}

export default function ResetPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [form, setForm] = useState({ password: "", confirmPassword: "" });
  const [error, setError] = useState("");
  const [errorKey, setErrorKey] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [resendNote, setResendNote] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const prefilled = useRef(false);

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
  const strength = getPasswordStrength(form.password);
  const pwPolicyError = passwordPolicyError(form.password);
  const passwordsMatch =
    form.confirmPassword.length > 0 && form.password === form.confirmPassword;
  const passwordsMismatch =
    form.confirmPassword.length > 0 && form.password !== form.confirmPassword;

  const blockSubmit =
    isSubmitting ||
    !emailValid ||
    !codeValid ||
    !form.password ||
    !form.confirmPassword ||
    Boolean(pwPolicyError) ||
    passwordsMismatch;

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

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
    if (pwPolicyError) {
      showError(pwPolicyError);
      return;
    }
    if (form.password !== form.confirmPassword) {
      showError("Passwords do not match.");
      return;
    }
    setIsSubmitting(true);
    try {
      await confirmPasswordReset({
        email: trimmedEmail,
        code,
        password: form.password,
        confirmPassword: form.confirmPassword,
      });
      setDone(true);
    } catch (err) {
      showError(
        getErrorMessage(
          err,
          "That code is incorrect or has expired. Request a new one."
        )
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
      await requestPasswordReset(trimmedEmail);
      setResendNote("If an account exists for that email, a new code is on its way.");
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
        <h1 className="text-h1 text-text-primary">Password reset</h1>
        <p className="mt-2 text-body-sm text-text-muted">
          Your password has been changed. Log in with your new password.
        </p>
        <Button href="/login" size="lg" className="mt-6 w-full">
          Log in
        </Button>
      </div>
    );
  }

  return shell(
    <>
      <div className="mb-6 flex flex-col items-center text-center">
        <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary-muted text-primary">
          <KeyRound className="h-6 w-6" aria-hidden="true" />
        </span>
        <h1 className="text-h1 text-text-primary">Choose a new password</h1>
        <p className="mt-1 text-body-sm text-text-muted">
          Enter the 6-digit code we emailed you, then your new password.
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
          <Label htmlFor="code">Reset code</Label>
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

        <div>
          <Label htmlFor="password">New password</Label>
          <PasswordInput
            id="password"
            name="password"
            autoComplete="new-password"
            minLength={MIN_PASSWORD_LENGTH}
            value={form.password}
            onChange={handleChange}
            aria-describedby="password-hint"
          />
          {strength && (
            <div id="password-hint" className="mt-1.5 animate-fade-in">
              <div className="flex gap-1">
                {STRENGTH_LEVELS.slice(1).map((level, i) => (
                  <div
                    key={level.label}
                    className={cn(
                      "h-1 flex-1 rounded-full transition-colors duration-200",
                      i < strength.score ? level.tone : "bg-surface-muted"
                    )}
                  />
                ))}
              </div>
              <p className="mt-1 text-caption text-text-muted">
                {pwPolicyError || `Strength: ${strength.label}`}
              </p>
            </div>
          )}
        </div>

        <div>
          <Label htmlFor="confirmPassword">Confirm new password</Label>
          <PasswordInput
            id="confirmPassword"
            name="confirmPassword"
            autoComplete="new-password"
            minLength={MIN_PASSWORD_LENGTH}
            value={form.confirmPassword}
            onChange={handleChange}
          />
          {passwordsMatch && (
            <p className="mt-1 flex items-center gap-1 text-caption text-success animate-fade-in">
              <Check className="h-3.5 w-3.5" aria-hidden="true" />
              Passwords match
            </p>
          )}
          {passwordsMismatch && (
            <p role="alert" className="mt-1 text-caption text-error animate-fade-in">
              Passwords do not match
            </p>
          )}
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
          disabled={blockSubmit}
          className="w-full"
        >
          {isSubmitting ? "Resetting…" : "Reset password"}
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
