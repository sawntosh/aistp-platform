import { useState } from "react";
import { fetchExplanation } from "../services/explanationsService";
import { RichText } from "../utils/richText";

export default function StudyAnswerFeedback({ isCorrect, correctAnswerText, questionId, onReviewConcept, onNext, isLastQuestion }) {
  const [explanation, setExplanation] = useState(null);
  const [isExplanationFallback, setIsExplanationFallback] = useState(false);
  const [isLoadingExplanation, setIsLoadingExplanation] = useState(false);
  const [explanationError, setExplanationError] = useState("");

  async function handleExplain() {
    setIsLoadingExplanation(true);
    setExplanationError("");
    try {
      const data = await fetchExplanation(questionId);
      setExplanation(data.explanation);
      setIsExplanationFallback(Boolean(data.is_fallback));
    } catch {
      setExplanationError("Couldn't load an explanation right now. Try again.");
    } finally {
      setIsLoadingExplanation(false);
    }
  }

  return (
    <div
      role="status"
      className={`mt-4 rounded-xl border p-6 animate-pop ${isCorrect ? "border-green-200 bg-green-50" : "border-amber-200 bg-amber-50"}`}
    >
      <p className={`flex items-center gap-2 font-semibold ${isCorrect ? "text-green-800" : "text-amber-800"}`}>
        <span aria-hidden="true">{isCorrect ? "✓" : "○"}</span>
        {isCorrect ? "Correct" : "Not quite"}
      </p>

      {!isCorrect && (
        <p className="mt-2 text-sm text-gray-700">
          The best answer is: <span className="font-medium text-gray-900">{correctAnswerText}</span>
        </p>
      )}

      <div className="mt-4">
        {!explanation && (
          <button
            type="button"
            onClick={handleExplain}
            disabled={isLoadingExplanation}
            className="text-sm font-medium text-indigo-600 hover:underline disabled:opacity-50"
          >
            {isLoadingExplanation ? "Asking AI tutor…" : "💡 Why this matters"}
          </button>
        )}
        {explanationError && <p className="mt-2 text-sm text-red-600">{explanationError}</p>}
        {explanation && (
          <div className="mt-2 rounded-lg border border-gray-200 bg-white p-3">
            {isExplanationFallback && (
              <p className="mb-1.5 text-xs font-medium text-amber-600">
                AI tutor is temporarily unavailable — showing a basic explanation.
              </p>
            )}
            <RichText text={explanation} />
          </div>
        )}
      </div>

      <div className="mt-5 flex flex-col gap-2 sm:flex-row">
        {!isCorrect && (
          <button
            type="button"
            onClick={onReviewConcept}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-all hover:bg-gray-50 active:scale-[0.98]"
          >
            Review this concept
          </button>
        )}
        <button
          type="button"
          onClick={onNext}
          className="flex-1 rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-gray-800 active:scale-[0.98]"
        >
          {isLastQuestion ? "Finish →" : "Next Question →"}
        </button>
      </div>
    </div>
  );
}
