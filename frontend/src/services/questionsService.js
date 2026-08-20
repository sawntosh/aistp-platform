import { apiFetch } from "./apiClient";

export async function fetchPracticeQuestions(count = 10, domains = []) {
  const params = new URLSearchParams({ count: String(count) });
  if (domains.length) params.set("domains", domains.join(","));
  return apiFetch(`/questions/?${params.toString()}`);
}

// `answer` shape depends on the question's question_type:
//   mcq / true_false -> { selected_option_id }
//   multi_select     -> { selected_option_ids: [] }
//   fill_blank       -> { text_answer }
//   matching         -> { matching_response: { [pairId]: matchText } }
export async function submitAnswer({ sessionId, questionId, answer }) {
  return apiFetch("/questions/submit/", {
    method: "POST",
    body: JSON.stringify({
      session_id: sessionId,
      question_id: questionId,
      ...answer,
    }),
  });
}

export async function finishSession(sessionId) {
  return apiFetch(`/questions/sessions/${sessionId}/finish/`, { method: "POST" });
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

// -- Admin: RAG generation from an uploaded PDF/DOCX -------------------------

export async function generateQuestionsFromFile(file, { questionTypes = [], targetPerDomain = 10 } = {}) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("target_per_domain", String(targetPerDomain));
  questionTypes.forEach((type) => formData.append("question_types", type));
  return apiFetch("/questions/admin/generate/", {
    method: "POST",
    body: formData,
  });
}

export async function fetchGenerationJob(jobId) {
  return apiFetch(`/questions/admin/generate/${jobId}/`);
}
