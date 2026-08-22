import { useState } from "react";
import { fetchExplanation } from "../services/explanationsService";

function ExplanationOption({ option, correct, reason }) {
  return (
    <div
      className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${
        correct ? "border-green-200 bg-green-50 text-green-900" : "border-red-200 bg-red-50 text-red-900"
      }`}
    >
      {correct ? (
        <svg viewBox="0 0 20 20" fill="currentColor" className="mt-0.5 h-4 w-4 shrink-0 text-green-600">
          <path
            fillRule="evenodd"
            d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z"
            clipRule="evenodd"
          />
        </svg>
      ) : (
        <svg viewBox="0 0 20 20" fill="currentColor" className="mt-0.5 h-4 w-4 shrink-0 text-red-500">
          <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
        </svg>
      )}
      <div>
        <p className="font-medium">{option}</p>
        {reason && <p className="mt-0.5 text-[13px] text-gray-700">{reason}</p>}
      </div>
    </div>
  );
}

export default function FeedbackPanel({
  isCorrect,
  correctOptionText,
  questionId,
  onNext,
  isLastQuestion,
}) {
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
      className={`rounded-xl border p-6 mt-4 animate-pop ${
        isCorrect ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"
      }`}
    >
      <p
        className={`flex items-center gap-1.5 font-semibold ${
          isCorrect ? "text-green-800" : "text-red-800"
        }`}
      >
        {isCorrect ? (
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
            <path
              fillRule="evenodd"
              d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z"
              clipRule="evenodd"
            />
          </svg>
        ) : (
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
            <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
          </svg>
        )}
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
          <div className="mt-2 space-y-2">
            {isExplanationFallback && (
              <p className="text-xs font-medium text-amber-600">
                AI tutor is temporarily unavailable — showing a basic explanation.
              </p>
            )}
            {explanation.items?.map((item) => (
              <ExplanationOption key={item.option} option={item.option} correct={item.correct} reason={item.reason} />
            ))}
            {explanation.summary && (
              <p className="rounded-lg border border-indigo-100 bg-indigo-50 px-3 py-2 text-sm text-indigo-900">
                {explanation.summary}
              </p>
            )}
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={onNext}
        className="mt-4 w-full rounded-md bg-gray-900 px-3 py-2 text-sm font-medium text-white transition-all hover:bg-gray-800 active:scale-[0.98]"
      >
        {isLastQuestion ? "Finish session" : "Next question"}
      </button>
    </div>
  );
}
