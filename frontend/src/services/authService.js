import { apiFetch, setToken } from "./apiClient";

const REFRESH_TOKEN_KEY = "aistp_refresh_token";

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

export async function login({ username, password }) {
  const data = await apiFetch("/auth/login/", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
  setToken(data.access);
  window.localStorage.setItem(REFRESH_TOKEN_KEY, data.refresh);
  return data;
}

// Called on app load: exchanges a stored refresh token for a fresh access
// token so the session survives a page reload (access token only lives in memory).
export async function refreshSession() {
  const refresh = window.localStorage.getItem(REFRESH_TOKEN_KEY);
  if (!refresh) return null;

  try {
    const data = await apiFetch("/auth/refresh/", {
      method: "POST",
      body: JSON.stringify({ refresh }),
    });
    setToken(data.access);
    return data.access;
  } catch {
    window.localStorage.removeItem(REFRESH_TOKEN_KEY);
    return null;
  }
}

export async function fetchCurrentUser() {
  return apiFetch("/auth/me/");
}

export function logout() {
  setToken(null);
  window.localStorage.removeItem(REFRESH_TOKEN_KEY);
}
