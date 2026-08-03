// Central fetch wrapper — attaches JWT from memory to every request and
// transparently refreshes an expired access token before failing a request.
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
const REFRESH_TOKEN_KEY = "aistp_refresh_token";

// Endpoints that must never trigger a refresh-and-retry themselves —
// otherwise a bad login attempt or an expired refresh token could loop.
const NO_REFRESH_PATHS = new Set(["/auth/login/", "/auth/register/", "/auth/refresh/"]);

let inMemoryToken = null;
let refreshPromise = null; // shared in-flight refresh, so concurrent 401s only trigger one call
let unauthorizedHandler = null;

export function setToken(token) {
  inMemoryToken = token;
}

export function setRefreshToken(token) {
  if (typeof window === "undefined") return;
  if (token) {
    window.localStorage.setItem(REFRESH_TOKEN_KEY, token);
  } else {
    window.localStorage.removeItem(REFRESH_TOKEN_KEY);
  }
}

export function getRefreshToken() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(REFRESH_TOKEN_KEY);
}

// Called by AuthContext so apiClient can clear session state when a refresh
// ultimately fails (e.g. refresh token expired/revoked mid-session).
export function setUnauthorizedHandler(handler) {
  unauthorizedHandler = handler;
}

async function rawRequest(path, options) {
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

function refreshAccessToken() {
  const refresh = getRefreshToken();
  if (!refresh) return Promise.resolve(null);

  if (!refreshPromise) {
    refreshPromise = rawRequest("/auth/refresh/", {
      method: "POST",
      body: JSON.stringify({ refresh }),
    })
      .then(({ res, body }) => {
        if (!res.ok) throw new Error("refresh failed");
        setToken(body.access);
        return body.access;
      })
      .catch(() => {
        setToken(null);
        setRefreshToken(null);
        if (unauthorizedHandler) unauthorizedHandler();
        return null;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

export async function apiFetch(path, options = {}) {
  let { res, body } = await rawRequest(path, options);

  if (res.status === 401 && !NO_REFRESH_PATHS.has(path)) {
    const refreshedToken = await refreshAccessToken();
    if (refreshedToken) {
      ({ res, body } = await rawRequest(path, options));
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
