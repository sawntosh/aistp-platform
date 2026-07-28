import { apiFetch } from "./apiClient";

export async function fetchExplanation(questionId) {
  return apiFetch("/explain/", {
    method: "POST",
    body: JSON.stringify({ question_id: questionId }),
  });
}
