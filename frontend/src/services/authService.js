import { apiFetch, getRefreshToken, setRefreshToken, setToken } from "./apiClient";

export async function register({ username, email, password, confirmPassword }) {
  return apiFetch("/auth/register/", {
    method: "POST",
    body: JSON.stringify({
      username,
      email,
      password,
      confirm_password: confirmPassword,
    }),
  });
}

// Live register-form check. Returns {username_available?, email_available?}
// where a field is omitted / null when the value isn't a valid format yet.
export async function checkAvailability({ username, email } = {}) {
  const params = new URLSearchParams();
  if (username) params.set("username", username);
  if (email) params.set("email", email);
  return apiFetch(`/auth/availability/?${params.toString()}`);
}

export async function verifyEmail(token) {
  return apiFetch("/auth/verify-email/", {
    method: "POST",
    body: JSON.stringify({ token }),
  });
}

export async function resendVerification(email) {
  return apiFetch("/auth/resend-verification/", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

// Always resolves 200 with a generic message -- the backend never reveals
// whether the address is registered.
export async function requestPasswordReset(email) {
  return apiFetch("/auth/password-reset/", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export async function confirmPasswordReset({ token, password, confirmPassword }) {
  return apiFetch("/auth/password-reset/confirm/", {
    method: "POST",
    body: JSON.stringify({ token, password, confirm_password: confirmPassword }),
  });
}

export async function login({ username, password }) {
  const data = await apiFetch("/auth/login/", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
  setToken(data.access);
  setRefreshToken(data.refresh);
  return data;
}

// Called on app load: exchanges a stored refresh token for a fresh access
// token so the session survives a page reload (access token only lives in memory).
export async function refreshSession() {
  if (!getRefreshToken()) return null;

  try {
    const data = await apiFetch("/auth/refresh/", {
      method: "POST",
      body: JSON.stringify({ refresh: getRefreshToken() }),
    });
    setToken(data.access);
    return data.access;
  } catch {
    setRefreshToken(null);
    return null;
  }
}

export async function fetchCurrentUser() {
  return apiFetch("/auth/me/");
}

export function logout() {
  setToken(null);
  setRefreshToken(null);
}
