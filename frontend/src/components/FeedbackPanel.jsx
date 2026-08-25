import { useState } from "react";
import { fetchExplanation } from "../services/explanationsService";
import { RichText } from "../utils/richText";

export default function FeedbackPanel({
  isCorrect,
  correctOptionText,
  questionId,
  domain,
  onNext,
  isLastQuestion,
  hideNext = false,
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
          <div className="mt-2 rounded-lg bg-white border border-gray-200 p-3">
            {isExplanationFallback && (
              <p className="mb-1.5 text-xs font-medium text-amber-600">
                AI tutor is temporarily unavailable — showing a basic explanation.
              </p>
            )}
            <RichText text={explanation} />
          </div>
        )}
      </div>

      {domain && (domain.description || domain.resources?.length > 0) && (
        <div className="mt-4 rounded-lg border border-gray-200 bg-white p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">About {domain.name}</p>
          {domain.description && <p className="mt-1 text-sm leading-relaxed text-gray-700">{domain.description}</p>}
          {domain.resources?.length > 0 && (
            <ul className="mt-2 space-y-1">
              {domain.resources.map((resource) => (
                <li key={resource.id}>
                  <a
                    href={resource.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-indigo-600 hover:underline"
                  >
                    {resource.title} ↗
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {!hideNext && (
        <button
          type="button"
          onClick={onNext}
          className="mt-4 w-full rounded-md bg-gray-900 px-3 py-2 text-sm font-medium text-white transition-all hover:bg-gray-800 active:scale-[0.98]"
        >
          {isLastQuestion ? "Finish session" : "Next question"}
        </button>
      )}
    </div>
  );
}
