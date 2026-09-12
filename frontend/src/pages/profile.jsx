import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { CheckCircle2, KeyRound, ShieldCheck, User as UserIcon } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { changePassword } from "../services/authService";
import { getErrorMessage } from "../services/apiClient";
import PageHeader from "../components/ui/PageHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/Card";
import Input, { Label } from "../components/ui/Input";
import PasswordInput from "../components/PasswordInput";
import Button from "../components/ui/Button";
import Alert from "../components/ui/Alert";
import UserAvatar from "../components/UserAvatar";

const MIN_PASSWORD_LENGTH = 8;

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

export default function ProfilePage() {
  const router = useRouter();
  const { user, isLoading: isAuthLoading } = useAuth();

  const [form, setForm] = useState({ oldPassword: "", newPassword: "", confirmNewPassword: "" });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isAuthLoading && !user) router.replace("/login");
  }, [isAuthLoading, user, router]);

  if (isAuthLoading || !user) return null;

  const pwPolicyError = passwordPolicyError(form.newPassword);
  const passwordsMismatch =
    form.confirmNewPassword.length > 0 && form.newPassword !== form.confirmNewPassword;

  const blockSubmit =
    isSubmitting ||
    !form.oldPassword ||
    !form.newPassword ||
    !form.confirmNewPassword ||
    Boolean(pwPolicyError) ||
    passwordsMismatch;

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (pwPolicyError) {
      setError(pwPolicyError);
      return;
    }
    if (passwordsMismatch) {
      setError("New passwords do not match.");
      return;
    }

    setIsSubmitting(true);
    try {
      await changePassword(form);
      setSuccess("Your password has been updated.");
      setForm({ oldPassword: "", newPassword: "", confirmNewPassword: "" });
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't update your password. Try again."));
    } finally {
      setIsSubmitting(false);
    }
  }

  const memberSince = user.date_joined
    ? new Date(user.date_joined).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })
    : null;

  return (
    <div className="min-h-[calc(100vh-57px)] sm:min-h-screen bg-background px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-2xl">
        <PageHeader eyebrow="Account" title="Your profile" description="View your account details and update your password." />

        <Card className="mb-6">
          <CardContent className="flex items-center gap-4">
            <UserAvatar name={user.username} size="lg" />
            <div className="min-w-0">
              <p className="truncate text-h3 text-text-primary">{user.username}</p>
              <p className="truncate text-body-sm text-text-muted">{user.email}</p>
            </div>
          </CardContent>

          <div className="divide-y divide-border border-t border-border px-5">
            <div className="flex items-center justify-between py-3">
              <span className="flex items-center gap-2 text-body-sm text-text-muted">
                <UserIcon className="h-4 w-4" aria-hidden="true" />
                Role
              </span>
              <span className="text-body-sm font-medium capitalize text-text-primary">
                {user.role === "admin" ? "Admin" : "Learner"}
              </span>
            </div>
            <div className="flex items-center justify-between py-3">
              <span className="flex items-center gap-2 text-body-sm text-text-muted">
                <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                Email verification
              </span>
              <span
                className={
                  user.email_verified
                    ? "inline-flex items-center gap-1 text-body-sm font-medium text-success"
                    : "inline-flex items-center gap-1 text-body-sm font-medium text-warning"
                }
              >
                {user.email_verified && <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />}
                {user.email_verified ? "Verified" : "Not verified"}
              </span>
            </div>
            {memberSince && (
              <div className="flex items-center justify-between py-3">
                <span className="text-body-sm text-text-muted">Member since</span>
                <span className="text-body-sm font-medium text-text-primary">{memberSince}</span>
              </div>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="h-4 w-4" aria-hidden="true" />
              Change password
            </CardTitle>
            <CardDescription>Choose a strong password you don&apos;t use anywhere else.</CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <div>
                <Label htmlFor="oldPassword">Current password</Label>
                <PasswordInput
                  id="oldPassword"
                  name="oldPassword"
                  autoComplete="current-password"
                  value={form.oldPassword}
                  onChange={handleChange}
                />
              </div>

              <div>
                <Label htmlFor="newPassword">New password</Label>
                <PasswordInput
                  id="newPassword"
                  name="newPassword"
                  autoComplete="new-password"
                  minLength={MIN_PASSWORD_LENGTH}
                  value={form.newPassword}
                  onChange={handleChange}
                />
                {form.newPassword && pwPolicyError && (
                  <p className="mt-1.5 text-caption text-text-muted">{pwPolicyError}</p>
                )}
              </div>

              <div>
                <Label htmlFor="confirmNewPassword">Confirm new password</Label>
                <PasswordInput
                  id="confirmNewPassword"
                  name="confirmNewPassword"
                  autoComplete="new-password"
                  minLength={MIN_PASSWORD_LENGTH}
                  value={form.confirmNewPassword}
                  onChange={handleChange}
                />
                {passwordsMismatch && (
                  <p role="alert" className="mt-1.5 text-caption text-error">
                    Passwords do not match
                  </p>
                )}
              </div>

              {error && (
                <Alert tone="error" title="Couldn't update password">
                  {error}
                </Alert>
              )}
              {success && <Alert tone="success">{success}</Alert>}

              <Button type="submit" isLoading={isSubmitting} disabled={blockSubmit}>
                {isSubmitting ? "Updating…" : "Update password"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
