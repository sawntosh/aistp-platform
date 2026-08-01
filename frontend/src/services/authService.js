import { apiFetch, clearTokens, refreshAccessToken, setRefreshToken, setToken } from "./apiClient";

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
  setRefreshToken(data.refresh);
  return data;
}

// Called on app load: exchanges a stored refresh token for a fresh access
// token so the session survives a page reload (access token only lives in memory).
export async function refreshSession() {
  return refreshAccessToken();
}

export async function fetchCurrentUser() {
  return apiFetch("/auth/me/");
}

export function logout() {
  clearTokens();
}
