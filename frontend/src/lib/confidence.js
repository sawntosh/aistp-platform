// Test Mode confidence tracking -- mirrors backend/questions/constants.py.
//
// Confidence is a 1-5 self-rating of how sure the learner is about an
// answer. It is a diagnostic signal only and never affects the score.

export const CONFIDENCE_LEVELS = [
  { value: 1, label: "Guessing" },
  { value: 2, label: "Not sure" },
  { value: 3, label: "Somewhat confident" },
  { value: 4, label: "Confident" },
  { value: 5, label: "Very confident" },
];

export const HIGH_CONFIDENCE_MIN = 4;
export const LOW_CONFIDENCE_MAX = 2;

export function confidenceLabel(value) {
  return CONFIDENCE_LEVELS.find((l) => l.value === value)?.label ?? null;
}

export function isHighConfidenceMistake(confidence, isCorrect) {
  return confidence != null && confidence >= HIGH_CONFIDENCE_MIN && !isCorrect;
}

export function isLowConfidenceCorrect(confidence, isCorrect) {
  return confidence != null && confidence <= LOW_CONFIDENCE_MAX && Boolean(isCorrect);
}
