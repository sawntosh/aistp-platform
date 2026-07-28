import { useState } from "react";
import { fetchExplanation } from "../services/explanationsService";

export default function FeedbackPanel({
  isCorrect,
  correctOptionText,
  questionId,
  onNext,
  isLastQuestion,
}) {
  const [explanation, setExplanation] = useState(null);
  const [isLoadingExplanation, setIsLoadingExplanation] = useState(false);
  const [explanationError, setExplanationError] = useState("");

  async function handleExplain() {
    setIsLoadingExplanation(true);
    setExplanationError("");
    try {
      const data = await fetchExplanation(questionId);
      setExplanation(data.explanation);
    } catch {
      setExplanationError("Couldn't load an explanation right now. Try again.");
    } finally {
      setIsLoadingExplanation(false);
    }
  }

  return (
    <div
      className={`rounded-xl border p-6 mt-4 ${
        isCorrect ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"
      }`}
    >
      <p className={`font-semibold ${isCorrect ? "text-green-800" : "text-red-800"}`}>
        {isCorrect ? "Correct!" : "Not quite."}
      </p>
      {!isCorrect && (
        <p className="mt-1 text-sm text-gray-700">
          Correct answer: <span className="font-medium">{correctOptionText}</span>
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
            {isLoadingExplanation ? "Asking AI tutor…" : "Explain this answer"}
          </button>
        )}
        {explanationError && <p className="mt-2 text-sm text-red-600">{explanationError}</p>}
        {explanation && (
          <div className="mt-2 rounded-lg bg-white border border-gray-200 p-3 text-sm text-gray-700">
            {explanation}
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={onNext}
        className="mt-4 w-full rounded-md bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-800"
      >
        {isLastQuestion ? "Finish session" : "Next question"}
      </button>
    </div>
  );
}
