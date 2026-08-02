import { apiFetch } from "./apiClient";

export async function fetchPracticeQuestions(count = 10) {
  return apiFetch(`/questions/?count=${count}`);
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
