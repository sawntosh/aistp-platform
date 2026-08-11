import { apiFetch } from "./apiClient";

export async function fetchPracticeQuestions(count = 10, domains = []) {
  const params = new URLSearchParams({ count: String(count) });
  if (domains.length) params.set("domains", domains.join(","));
  return apiFetch(`/questions/?${params.toString()}`);
}

export async function submitAnswer({ sessionId, questionId, optionId }) {
  return apiFetch("/questions/submit/", {
    method: "POST",
    body: JSON.stringify({
      session_id: sessionId,
      question_id: questionId,
      option_id: optionId,
    }),
  });
}
