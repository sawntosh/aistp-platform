import { useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { ArrowLeft, GraduationCap, ShieldCheck } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { getErrorMessage } from "../services/apiClient";
import PasswordInput from "../components/PasswordInput";
import Input, { Label } from "../components/ui/Input";
import Button from "../components/ui/Button";
import Alert from "../components/ui/Alert";
import SegmentedControl from "../components/ui/SegmentedControl";

const ROLES = [
  { value: "student", label: "Student", icon: GraduationCap, redirect: "/practice", subtitle: "Log in to continue your CTFL preparation" },
  { value: "admin", label: "Admin", icon: ShieldCheck, redirect: "/admin", subtitle: "Log in to manage AISTP content" },
];

export default function LoginPage() {
  const router = useRouter();
  const { login, logout } = useAuth();
  const [role, setRole] = useState("student");
  const [form, setForm] = useState({ username: "", password: "" });
  const [error, setError] = useState("");
  const [errorKey, setErrorKey] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [needsVerification, setNeedsVerification] = useState(false);

  const justRegistered = router.query.registered === "1";
  const activeRole = ROLES.find((r) => r.value === role) ?? ROLES[0];
  const otherRole = ROLES.find((r) => r.value !== role);

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
    setNeedsVerification(false);

    if (!/^[A-Za-z]+$/.test(form.username)) {
      showError("Username must contain letters only (A–Z).");
      return;
    }

    setIsSubmitting(true);
    try {
      const me = await login(form);
      if (me.role !== role) {
        logout();
        showError(`This account is a ${otherRole.label} account. Switch to "${otherRole.label}" above and try again.`);
        return;
      }
      router.push(activeRole.redirect);
    } catch (err) {
      // 403 = correct password but the account's email isn't verified yet.
      if (err?.status === 403 && err?.body?.can_resend) {
        setNeedsVerification(true);
        showError(err.body.detail || "Please verify your email address before logging in.");
      } else if (err?.status === 423) {
        showError(err?.body?.detail || "Too many failed attempts. Try again shortly.");
      } else {
        showError(getErrorMessage(err, "Invalid username or password."));
      }
    } finally {
      setIsSubmitting(false);
    }
  }


  return (
    <div className="relative flex min-h-screen w-full items-center justify-center bg-background px-4 py-10">
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
            <activeRole.icon className="h-6 w-6" aria-hidden="true" />
          </span>
          <h1 className="text-h1 text-text-primary">Welcome back</h1>
          <p className="mt-1 text-body-sm text-text-muted">{activeRole.subtitle}</p>
        </div>

        <SegmentedControl
          options={ROLES}
          value={role}
          onChange={(next) => {
            setRole(next);
            setError("");
          }}
          className="mb-6 w-full [&>button]:flex-1 [&>button]:justify-center"
        />

        {justRegistered && (
          <Alert tone="success" className="mb-4">
            Account created. Log in to continue.
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              name="username"
              type="text"
              required
              autoComplete="username"
              value={form.username}
              onChange={handleChange}
            />
          </div>

          <div>
            <Label htmlFor="password">Password</Label>
            <PasswordInput
              id="password"
              name="password"
              autoComplete="current-password"
              value={form.password}
              onChange={handleChange}
            />
          </div>

          {error && (
            <p key={errorKey} className="text-body-sm text-error animate-fade-in">
              {error}
            </p>
          )}

          {needsVerification && (
            <p className="text-body-sm text-text-muted animate-fade-in">
              <Link href="/verify-email" className="font-medium text-primary hover:underline">
                Resend verification email
              </Link>{" "}
              — in local dev the link is printed to the server console.
            </p>
          )}

          <Button type="submit" size="lg" isLoading={isSubmitting} className="w-full">
            {isSubmitting ? "Logging in…" : `Log in as ${activeRole.label}`}
          </Button>
        </form>

        <div className="mt-6 border-t border-border pt-4 text-center">
          <p className="text-body-sm text-text-muted">
            Don&apos;t have an account?{" "}
            <Link href="/register" className="font-medium text-primary hover:underline">
              Register
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
