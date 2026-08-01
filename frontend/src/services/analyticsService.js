import { apiFetch } from "./apiClient";

// GET /analytics/dashboard/ -- FR-05. Expected shape (backend contract, not yet implemented):
// {
//   overall_accuracy: number,
//   domains: [{ domain, correct_count, total_count, accuracy_percent }],   // 6 CTFL domains
//   sessions: [{ id, started_at, finished_at, question_count, score, accuracy_percent }],
// }
export async function fetchDashboardAnalytics() {
  return apiFetch("/analytics/dashboard/");
}
