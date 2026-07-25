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
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}
