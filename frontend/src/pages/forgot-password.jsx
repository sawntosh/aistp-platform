import { useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { ArrowLeft, KeyRound } from "lucide-react";
import { requestPasswordReset } from "../services/authService";
import Input, { Label } from "../components/ui/Input";
import Button from "../components/ui/Button";

// Local part: letters/digits/dots with at least one letter -- mirrors the
// backend's Gmail rule so an obviously-wrong address is caught before the
// request is sent.
const GMAIL_REGEX = /^(?=[A-Za-z0-9.]*[A-Za-z])[A-Za-z0-9.]+@gmail\.com$/i;

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const trimmed = email.trim();
  const emailInvalid = trimmed.length > 0 && !GMAIL_REGEX.test(trimmed);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!GMAIL_REGEX.test(trimmed)) {
      setError("Enter the Gmail address you registered with (e.g. name123@gmail.com).");
      return;
    }
    setIsSubmitting(true);
    try {
      // Always succeeds with a generic message -- the response is the same
      // whether or not the address is registered. Move straight to the code
      // + new-password step.
      await requestPasswordReset(trimmed);
      router.push(`/reset-password?email=${encodeURIComponent(trimmed)}`);
    } catch {
      setError("Couldn't send the reset email right now. Try again in a moment.");
      setIsSubmitting(false);
    }
  }

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center bg-background px-4 py-12">
      <Link
        href="/login"
        aria-label="Back to login"
        className="absolute top-6 left-6 flex h-10 w-10 items-center justify-center rounded-full text-text-muted transition-colors hover:bg-surface-muted hover:text-text-primary"
      >
        <ArrowLeft className="h-5 w-5" aria-hidden="true" />
      </Link>

      <div className="w-full max-w-sm rounded-lg border border-border bg-surface p-8 shadow-sm">
        <>
            <div className="mb-6 flex flex-col items-center text-center">
              <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary-muted text-primary">
                <KeyRound className="h-6 w-6" aria-hidden="true" />
              </span>
              <h1 className="text-h1 text-text-primary">Forgot your password?</h1>
              <p className="mt-1 text-body-sm text-text-muted">
                Enter your email and we&apos;ll send you a 6-digit reset code.
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
                  invalid={emailInvalid}
                />
                {emailInvalid && (
                  <p role="alert" className="mt-1 text-caption text-error animate-fade-in">
                    Must be a Gmail address (e.g. name123@gmail.com)
                  </p>
                )}
              </div>

              {error && (
                <p role="alert" className="text-body-sm text-error animate-fade-in">
                  {error}
                </p>
              )}

              <Button
                type="submit"
                size="lg"
                isLoading={isSubmitting}
                disabled={isSubmitting || !trimmed || emailInvalid}
                className="w-full"
              >
                {isSubmitting ? "Sending…" : "Send reset code"}
              </Button>
            </form>

            <p className="mt-4 text-center text-body-sm text-text-muted">
              Remembered it?{" "}
              <Link href="/login" className="font-medium text-primary hover:underline">
                Log in
              </Link>
            </p>
        </>
      </div>
    </div>
  );
}
