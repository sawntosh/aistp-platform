import { apiFetch } from "./apiClient";

// GET /analytics/dashboard/ -- FR-05. Shape:
// {
//   overall_accuracy: number,
//   domains: [{ domain, correct_count, total_count, accuracy_percent,
//               average_confidence, high_confidence_mistakes, low_confidence_correct }],
//   sessions: [{ id, started_at, finished_at, question_count, score, accuracy_percent }],
//   confidence: {                       // Test Mode only, diagnostic — never affects accuracy
//     average_confidence: number|null,
//     rated_count: number,
//     by_level: [{ level, label, correct, total, accuracy_percent }],   // levels 1..5
//     high_confidence_mistakes: number, // rated >= 4 but wrong
//     low_confidence_correct: number,   // rated <= 2 but right
//   },
// }
export async function fetchDashboardAnalytics() {
  return apiFetch("/analytics/dashboard/");
}
