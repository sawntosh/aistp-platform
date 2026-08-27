import { apiFetch } from "./apiClient";

export async function fetchStudyDomains() {
  return apiFetch("/study/domains/");
}

export async function fetchStudyTopics(domainId) {
  return apiFetch(`/study/domains/${domainId}/topics/`);
}

export async function startStudyTopic(topicId) {
  return apiFetch(`/study/topics/${topicId}/start/`, { method: "POST" });
}

// `answer` shape depends on the question's question_type -- same
// payload shapes as questionsService.submitAnswer.
export async function submitStudyAnswer(sessionId, questionId, answer) {
  return apiFetch(`/study/sessions/${sessionId}/answer/`, {
    method: "POST",
    body: JSON.stringify({ question_id: questionId, ...answer }),
  });
}

export async function completeStudySession(sessionId) {
  return apiFetch(`/study/sessions/${sessionId}/complete/`, { method: "POST" });
}
