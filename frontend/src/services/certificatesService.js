import { apiFetch } from "./apiClient";

// Certificates the signed-in learner has earned.
export async function fetchMyCertificates() {
  return apiFetch("/certificates/");
}

// Turn a passing Real Exam session into a certificate. Idempotent on the
// backend -- a session that already has one just returns it. The name is
// always the account's username.
export async function claimCertificate({ sessionId }) {
  return apiFetch("/certificates/claim/", {
    method: "POST",
    body: JSON.stringify({ session_id: sessionId }),
  });
}

// Direct link to the server-rendered PDF (public, keyed by certificate id).
export function certificatePdfUrl(certificateId, { download = false } = {}) {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
  const query = download ? "?download=1" : "";
  return `${base}/certificates/${encodeURIComponent(certificateId)}/pdf/${query}`;
}
