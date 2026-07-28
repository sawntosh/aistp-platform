// Central fetch wrapper — attaches JWT from memory to every request.
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

let inMemoryToken = null;

export function setToken(token) {
  inMemoryToken = token;
}

export async function apiFetch(path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(inMemoryToken ? { Authorization: `Bearer ${inMemoryToken}` } : {}),
    ...options.headers,
  };
  const res = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
  const contentType = res.headers.get("content-type") || "";
  const body = contentType.includes("application/json") ? await res.json() : null;

  if (!res.ok) {
    const error = new Error(`API error: ${res.status}`);
    error.status = res.status;
    error.body = body;
    throw error;
  }
  return body;
}

// Pulls the first message out of a DRF error body (field errors or {detail}).
export function getErrorMessage(error, fallback) {
  const body = error?.body;
  if (!body || typeof body !== "object") return fallback;
  const firstValue = Object.values(body)[0];
  if (Array.isArray(firstValue)) return String(firstValue[0]);
  return firstValue ? String(firstValue) : fallback;
}
