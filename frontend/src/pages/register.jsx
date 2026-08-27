import { useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { ArrowLeft, Check, GraduationCap } from "lucide-react";
import { useAuth } from "../context/AuthContext";
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

const GMAIL_REGEX = /^[^\s@]+@gmail\.com$/i;
const MIN_PASSWORD_LENGTH = 6;

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

export default function RegisterPage() {
  const router = useRouter();
  const { register } = useAuth();
  const [form, setForm] = useState({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [error, setError] = useState("");
  const [errorKey, setErrorKey] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const strength = getPasswordStrength(form.password);
  const passwordsMatch = form.confirmPassword.length > 0 && form.password === form.confirmPassword;
  const passwordsMismatch = form.confirmPassword.length > 0 && form.password !== form.confirmPassword;
  const emailInvalid = form.email.length > 0 && !GMAIL_REGEX.test(form.email);

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

    if (!GMAIL_REGEX.test(form.email)) {
      showError("Email must be a valid Gmail address (e.g. name@gmail.com).");
      return;
    }

    if (form.password.length < MIN_PASSWORD_LENGTH) {
      showError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }

    if (form.password !== form.confirmPassword) {
      showError("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);
    try {
      await register(form);
      router.push("/login?registered=1");
    } catch (err) {
      showError(getErrorMessage(err, "Registration failed. Check your details and try again."));
    } finally {
      setIsSubmitting(false);
    }
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
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="username">Username</Label>
            <Input id="username" name="username" type="text" required autoComplete="username" value={form.username} onChange={handleChange} />
          </div>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="name@gmail.com"
              pattern="[^\s@]+@gmail\.com"
              title="Must be a Gmail address, e.g. name@gmail.com"
              value={form.email}
              onChange={handleChange}
              invalid={emailInvalid}
            />
            {emailInvalid && <p className="mt-1 text-caption text-error animate-fade-in">Must be a Gmail address (e.g. name@gmail.com)</p>}
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <PasswordInput id="password" name="password" autoComplete="new-password" minLength={MIN_PASSWORD_LENGTH} value={form.password} onChange={handleChange} />
            {strength && (
              <div className="mt-1.5 animate-fade-in">
                <div className="flex gap-1">
                  {STRENGTH_LEVELS.slice(1).map((level, i) => (
                    <div key={level.label} className={cn("h-1 flex-1 rounded-full transition-colors duration-200", i < strength.score ? level.tone : "bg-surface-muted")} />
                  ))}
                </div>
                <p className="mt-1 text-caption text-text-muted">{strength.label}</p>
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
            {passwordsMismatch && <p className="mt-1 text-caption text-error animate-fade-in">Passwords do not match</p>}
          </div>

          {error && (
            <p key={errorKey} className="text-body-sm text-error animate-fade-in">
              {error}
            </p>
          )}

          <Button type="submit" size="lg" isLoading={isSubmitting} className="w-full">
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
