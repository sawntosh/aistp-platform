import { useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { useAuth } from "../context/AuthContext";
import { getErrorMessage } from "../services/apiClient";
import PasswordInput from "../components/PasswordInput";

const STRENGTH_LEVELS = [
  { label: "Too short", color: "bg-gray-200" },
  { label: "Weak", color: "bg-red-400" },
  { label: "Fair", color: "bg-yellow-400" },
  { label: "Good", color: "bg-blue-400" },
  { label: "Strong", color: "bg-green-500" },
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
    <div className="flex min-h-screen w-full items-center justify-center bg-gradient-to-b from-orange-50 via-amber-100 to-amber-200 px-4 py-12">
      <div className="w-full max-w-sm rounded-[2rem] bg-white p-8 shadow-xl">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-amber-300 to-orange-400 text-2xl shadow-md">
            🎓
          </div>
          <h1 className="text-2xl font-semibold text-gray-900">Create your account</h1>
          <p className="text-sm text-gray-500">Start practicing for CTFL</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-gray-700">
              Username
            </label>
            <input
              id="username"
              name="username"
              type="text"
              required
              autoComplete="username"
              value={form.username}
              onChange={handleChange}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm transition-colors focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
            />
          </div>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              Email
            </label>
            <input
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
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm transition-colors focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
            />
            {emailInvalid && (
              <p className="mt-1 text-xs text-red-600 animate-fade-in">Must be a Gmail address (e.g. name@gmail.com)</p>
            )}
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
              Password
            </label>
            <PasswordInput
              id="password"
              name="password"
              autoComplete="new-password"
              minLength={MIN_PASSWORD_LENGTH}
              value={form.password}
              onChange={handleChange}
            />
            {strength && (
              <div className="mt-1.5 animate-fade-in">
                <div className="flex gap-1">
                  {STRENGTH_LEVELS.slice(1).map((level, i) => (
                    <div
                      key={level.label}
                      className={`h-1 flex-1 rounded-full transition-colors duration-200 ${
                        i < strength.score ? strength.color : "bg-gray-200"
                      }`}
                    />
                  ))}
                </div>
                <p className="mt-1 text-xs text-gray-500">{strength.label}</p>
              </div>
            )}
          </div>
          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
              Confirm password
            </label>
            <PasswordInput
              id="confirmPassword"
              name="confirmPassword"
              autoComplete="new-password"
              minLength={MIN_PASSWORD_LENGTH}
              value={form.confirmPassword}
              onChange={handleChange}
            />
            {passwordsMatch && (
              <p className="mt-1 flex items-center gap-1 text-xs text-green-600 animate-fade-in">
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                  <path
                    fillRule="evenodd"
                    d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z"
                    clipRule="evenodd"
                  />
                </svg>
                Passwords match
              </p>
            )}
            {passwordsMismatch && (
              <p className="mt-1 text-xs text-red-600 animate-fade-in">Passwords do not match</p>
            )}
          </div>

          {error && (
            <p key={errorKey} className="text-sm text-red-600 animate-fade-in">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-200 to-amber-300 py-3 text-sm font-bold text-gray-900 shadow-sm transition-all hover:from-amber-300 hover:to-amber-400 active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100"
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
            {isSubmitting ? "Creating account…" : "Create account"}
          </button>
        </form>

        <p className="mt-4 text-sm text-gray-600">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-amber-600 hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
