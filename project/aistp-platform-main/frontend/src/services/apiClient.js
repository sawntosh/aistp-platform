// Central fetch wrapper — attaches JWT from memory to every request, and
// owns refresh-token persistence + silent access-token refresh on 401.
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
const REFRESH_TOKEN_KEY = "aistp_refresh_token";
const REFRESH_PATH = "/auth/refresh/";

let inMemoryToken = null;
let refreshPromise = null;
let sessionExpiredHandler = null;

export function setToken(token) {
  inMemoryToken = token;
}

export function setRefreshToken(refresh) {
  window.localStorage.setItem(REFRESH_TOKEN_KEY, refresh);
}

export function clearTokens() {
  inMemoryToken = null;
  window.localStorage.removeItem(REFRESH_TOKEN_KEY);
}

// Called once by AuthContext so a refresh that fails mid-session (expired/
// revoked refresh token) can clear the logged-in user and let the existing
// page-level "redirect to /login if no user" guards take over.
export function onSessionExpired(handler) {
  sessionExpiredHandler = handler;
}

async function rawFetch(path, options) {
  const headers = {
    "Content-Type": "application/json",
    ...(inMemoryToken ? { Authorization: `Bearer ${inMemoryToken}` } : {}),
    ...options.headers,
  };
  const res = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
  const contentType = res.headers.get("content-type") || "";
  const body = contentType.includes("application/json") ? await res.json() : null;
  return { res, body };
}

// Exchanges the stored refresh token for a fresh access token. Concurrent
// 401s share one in-flight refresh instead of each firing their own.
export function refreshAccessToken() {
  const refresh = window.localStorage.getItem(REFRESH_TOKEN_KEY);
  if (!refresh) return Promise.resolve(null);

  if (!refreshPromise) {
    refreshPromise = rawFetch(REFRESH_PATH, {
      method: "POST",
      body: JSON.stringify({ refresh }),
    })
      .then(({ res, body }) => {
        if (!res.ok) throw new Error("refresh failed");
        setToken(body.access);
        return body.access;
      })
      .catch(() => {
        clearTokens();
        sessionExpiredHandler?.();
        return null;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

export async function apiFetch(path, options = {}) {
  let { res, body } = await rawFetch(path, options);

  // Access token expired mid-session -- refresh once and retry before
  // surfacing the error. Skip for the refresh call itself and for requests
  // that were never authenticated to begin with (e.g. login/register).
  if (res.status === 401 && inMemoryToken && path !== REFRESH_PATH) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      ({ res, body } = await rawFetch(path, options));
    }
  }

  if (!res.ok) {
    const error = new Error(`API error: ${res.status}`);
    error.status = res.status;
    error.body = body;
    throw error;
  }
  return body;
}

// Flattens every message out of a DRF error body (field errors, non_field_errors,
// {detail}) instead of only the first, so multi-field validation failures aren't
// silently dropped.
export function getErrorMessage(error, fallback) {
  const body = error?.body;
  if (!body || typeof body !== "object") return fallback;

  const messages = Object.values(body)
    .flatMap((value) => (Array.isArray(value) ? value : [value]))
    .filter(Boolean)
    .map(String);

  return messages.length ? messages.join(" ") : fallback;
}
