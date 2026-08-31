import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { ArrowLeft, Check, GraduationCap, Loader2, MailCheck, X } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { checkAvailability, resendVerification } from "../services/authService";
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

// Local part: letters/digits/dots, and must contain at least one letter
// (so "111@gmail.com" is rejected but "name123@gmail.com" is fine).
const GMAIL_REGEX = /^(?=[A-Za-z0-9.]*[A-Za-z])[A-Za-z0-9.]+@gmail\.com$/i;
const USERNAME_REGEX = /^[A-Za-z]+$/;
const USERNAME_MIN_LENGTH = 3;
const MIN_PASSWORD_LENGTH = 8;
const AVAILABILITY_DEBOUNCE_MS = 400;

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

function usernameFormatError(username) {
  if (!username) return "";
  if (!USERNAME_REGEX.test(username)) return "Letters only — no spaces, digits or symbols";
  if (username.length < USERNAME_MIN_LENGTH) return `Must be at least ${USERNAME_MIN_LENGTH} characters`;
  return "";
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

// "unknown" | "checking" | "available" | "taken"
function FieldStatus({ state, label }) {
  if (state === "checking") {
    return (
      <p className="mt-1 flex items-center gap-1 text-caption text-text-muted animate-fade-in">
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> Checking availability…
      </p>
    );
  }
  if (state === "available") {
    return (
      <p className="mt-1 flex items-center gap-1 text-caption text-success animate-fade-in">
        <Check className="h-3.5 w-3.5" aria-hidden="true" /> {label} is available
      </p>
    );
  }
  if (state === "taken") {
    return (
      <p role="alert" className="mt-1 flex items-center gap-1 text-caption text-error animate-fade-in">
        <X className="h-3.5 w-3.5" aria-hidden="true" /> That {label.toLowerCase()} is already taken
      </p>
    );
  }
  return null;
}

export default function RegisterPage() {
  const router = useRouter();
  const { register } = useAuth();
  const [form, setForm] = useState({ username: "", email: "", password: "", confirmPassword: "" });
  const [error, setError] = useState("");
  const [errorKey, setErrorKey] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState("");
  const [usernameStatus, setUsernameStatus] = useState("unknown");
  const [emailStatus, setEmailStatus] = useState("unknown");

  // Trailing/leading whitespace is meaningless in a username or email and a
  // stray space would silently fail the backend's exact match -- trim before
  // any validation, display, or submit. (Passwords are left untouched.)
  const username = form.username.trim();
  const email = form.email.trim();

  const strength = getPasswordStrength(form.password);
  const passwordsMatch = form.confirmPassword.length > 0 && form.password === form.confirmPassword;
  const passwordsMismatch = form.confirmPassword.length > 0 && form.password !== form.confirmPassword;

  const usernameError = usernameFormatError(username);
  const emailInvalid = email.length > 0 && !GMAIL_REGEX.test(email);
  const pwPolicyError = passwordPolicyError(form.password);

  const usernameLooksValid = username.length > 0 && !usernameError;
  const emailLooksValid = email.length > 0 && !emailInvalid;

  // -- debounced availability checks --------------------------------------
  useEffect(() => {
    if (!usernameLooksValid) {
      setUsernameStatus("unknown");
      return;
    }
    setUsernameStatus("checking");
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const res = await checkAvailability({ username });
        if (!cancelled) {
          setUsernameStatus(
            res.username_available === true ? "available" : res.username_available === false ? "taken" : "unknown"
          );
        }
      } catch {
        if (!cancelled) setUsernameStatus("unknown");
      }
    }, AVAILABILITY_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [username, usernameLooksValid]);

  useEffect(() => {
    if (!emailLooksValid) {
      setEmailStatus("unknown");
      return;
    }
    setEmailStatus("checking");
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const res = await checkAvailability({ email });
        if (!cancelled) {
          setEmailStatus(
            res.email_available === true ? "available" : res.email_available === false ? "taken" : "unknown"
          );
        }
      } catch {
        if (!cancelled) setEmailStatus("unknown");
      }
    }, AVAILABILITY_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [email, emailLooksValid]);

  const blockSubmit =
    isSubmitting ||
    !username ||
    !email ||
    !form.password ||
    !form.confirmPassword ||
    Boolean(usernameError) ||
    emailInvalid ||
    Boolean(pwPolicyError) ||
    passwordsMismatch ||
    usernameStatus === "taken" ||
    emailStatus === "taken";

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

    if (usernameError) {
      showError(`Username: ${usernameError.toLowerCase()}.`);
      return;
    }
    if (!GMAIL_REGEX.test(email)) {
      showError("Email must be a Gmail address with at least one letter before @ (e.g. name123@gmail.com).");
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
      await register({ ...form, username, email });
      setRegisteredEmail(email);
    } catch (err) {
      showError(getErrorMessage(err, "Registration failed. Check your details and try again."));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleResend() {
    setError("");
    try {
      await resendVerification(registeredEmail);
      showError("");
    } catch {
      showError("Couldn't resend right now. Try again in a moment.");
    }
  }

  if (registeredEmail) {
    return (
      <div className="relative flex min-h-screen w-full items-center justify-center bg-background px-4 py-12">
        <div className="w-full max-w-sm rounded-lg border border-border bg-surface p-8 text-center shadow-sm">
          <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-success-muted text-success">
            <MailCheck className="h-6 w-6" aria-hidden="true" />
          </span>
          <h1 className="text-h1 text-text-primary">Check your email</h1>
          <p className="mt-2 text-body-sm text-text-muted">
            We sent a verification link to <span className="font-medium text-text-primary">{registeredEmail}</span>.
            Click it to activate your account, then log in.
          </p>
          {error && (
            <p key={errorKey} role="alert" className="mt-3 text-body-sm text-error animate-fade-in">
              {error}
            </p>
          )}
          <div className="mt-6 space-y-2">
            <Button href="/login" size="lg" className="w-full">Go to login</Button>
            <button type="button" onClick={handleResend} className="text-body-sm text-primary hover:underline">
              Didn&apos;t get it? Resend link
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center bg-background px-4 py-12">
      <Link
        href="/"
        aria-label="Back to home"
        className="absolute top-6 left-6 flex h-10 w-10 items-center justify-center rounded-full text-text-muted transition-colors hover:bg-surface-muted hover:text-text-primary"
      >
        <ArrowLeft className="h-5 w-5" aria-hidden="true" />
      </Link>

      <div className="w-full max-w-sm rounded-lg border border-border bg-surface p-8 shadow-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary-muted text-primary">
            <GraduationCap className="h-6 w-6" aria-hidden="true" />
          </span>
          <h1 className="text-h1 text-text-primary">Create your account</h1>
          <p className="mt-1 text-body-sm text-text-muted">Start practicing for CTFL</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div>
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              name="username"
              type="text"
              required
              autoComplete="username"
              title="Letters only, at least 3 characters, e.g. alice"
              value={form.username}
              onChange={handleChange}
              invalid={Boolean(usernameError) || usernameStatus === "taken"}
              aria-describedby="username-hint"
            />
            <span id="username-hint">
              {usernameError ? (
                <p role="alert" className="mt-1 text-caption text-error animate-fade-in">{usernameError}</p>
              ) : (
                <FieldStatus state={usernameStatus} label="Username" />
              )}
            </span>
          </div>

          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="name123@gmail.com"
              title="Gmail address with at least one letter before @, e.g. name123@gmail.com"
              value={form.email}
              onChange={handleChange}
              invalid={emailInvalid || emailStatus === "taken"}
              aria-describedby="email-hint"
            />
            <span id="email-hint">
              {emailInvalid ? (
                <p role="alert" className="mt-1 text-caption text-error animate-fade-in">
                  Must be a Gmail address with at least one letter before @ (e.g. name123@gmail.com)
                </p>
              ) : (
                <FieldStatus state={emailStatus} label="Email" />
              )}
            </span>
          </div>

          <div>
            <Label htmlFor="password">Password</Label>
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
            <Label htmlFor="confirmPassword">Confirm password</Label>
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
              <p role="alert" className="mt-1 text-caption text-error animate-fade-in">Passwords do not match</p>
            )}
          </div>

          {error && (
            <p key={errorKey} role="alert" className="text-body-sm text-error animate-fade-in">
              {error}
            </p>
          )}

          <Button type="submit" size="lg" isLoading={isSubmitting} disabled={blockSubmit} className="w-full">
            {isSubmitting ? "Creating account…" : "Create account"}
          </Button>
        </form>

        <p className="mt-4 text-center text-body-sm text-text-muted">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-primary hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
