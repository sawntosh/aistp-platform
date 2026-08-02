import { useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { useAuth } from "../context/AuthContext";
import { getErrorMessage } from "../services/apiClient";
import PasswordInput from "../components/PasswordInput";

const FILLED_INPUT_CLASS =
  "w-full rounded-2xl border-0 bg-gray-100 px-5 py-4 text-sm text-gray-900 placeholder-gray-500 transition-colors focus:outline-none focus:ring-2 focus:ring-amber-300";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [form, setForm] = useState({ username: "", password: "" });
  const [error, setError] = useState("");
  const [errorKey, setErrorKey] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const justRegistered = router.query.registered === "1";

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
    setIsSubmitting(true);
    try {
      await login(form);
      router.push("/practice");
    } catch (err) {
      showError(getErrorMessage(err, "Invalid username or password."));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-gradient-to-b from-orange-50 via-amber-100 to-amber-200 px-4 py-10">
      <div className="pointer-events-none absolute -left-20 top-16 h-64 w-64 rounded-full bg-rose-300/30 blur-3xl" />
      <div className="pointer-events-none absolute -right-16 bottom-16 h-72 w-72 rounded-full bg-amber-300/40 blur-3xl" />

      <div className="relative w-full max-w-sm rounded-[2rem] bg-white p-8 shadow-xl">
        <div className="relative mx-auto mb-4 flex h-20 w-20 items-center justify-center">
          <div className="absolute inset-0 rounded-full bg-gradient-to-br from-amber-300 via-orange-400 to-rose-400 opacity-60 blur-xl" />
          <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-amber-300 via-orange-400 to-rose-400 text-3xl shadow-lg">
            🎓
          </div>
        </div>
        <h1 className="text-center text-2xl font-bold text-gray-900">
          Student{" "}
          <span className="bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 bg-clip-text text-transparent">
            Login
          </span>
        </h1>

        {justRegistered && (
          <p className="mt-4 rounded-2xl bg-green-50 px-3 py-2 text-center text-sm text-green-700 animate-fade-in">
            Account created. Log in to continue.
          </p>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-3">
          <input
            id="username"
            name="username"
            type="text"
            required
            autoComplete="username"
            placeholder="Username"
            aria-label="Username"
            value={form.username}
            onChange={handleChange}
            className={FILLED_INPUT_CLASS}
          />

          <PasswordInput
            id="password"
            name="password"
            autoComplete="current-password"
            placeholder="Password"
            value={form.password}
            onChange={handleChange}
            inputClassName={`${FILLED_INPUT_CLASS} pr-12`}
          />

          {error && (
            <p key={errorKey} className="text-center text-sm text-red-600 animate-fade-in">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-200 to-amber-300 py-4 text-base font-bold text-gray-900 shadow-sm transition-all hover:from-amber-300 hover:to-amber-400 active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100"
          >
            {isSubmitting && (
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4Z"
                />
              </svg>
            )}
            {isSubmitting ? "Logging in…" : "Log In"}
          </button>
        </form>

        <p className="mt-4 text-center text-sm font-medium text-amber-600">Forgot Password?</p>

        <div className="mt-6 border-t border-gray-200" />

        <p className="mt-4 text-center text-xs text-gray-400">
          Don&apos;t have an account?{" "}
          <Link href="/register" className="font-medium text-gray-600 hover:underline">
            Register
          </Link>
        </p>
      </div>
    </div>
  );
}
