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

// -- Admin: domains --------------------------------------------------------

export async function fetchDomains() {
  return apiFetch("/questions/domains/");
}

// -- Admin: question CRUD ---------------------------------------------------

export async function fetchAdminQuestions() {
  return apiFetch("/questions/admin/questions/");
}

export async function createQuestion(payload) {
  return apiFetch("/questions/admin/questions/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateQuestion(id, payload) {
  return apiFetch(`/questions/admin/questions/${id}/`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function deleteQuestion(id) {
  return apiFetch(`/questions/admin/questions/${id}/`, { method: "DELETE" });
}

// -- Admin: bulk JSON import -------------------------------------------------

export async function importQuestionsFile(file) {
  const formData = new FormData();
  formData.append("file", file);
  return apiFetch("/questions/admin/questions/import/", {
    method: "POST",
    body: formData,
  });
}
