import { useState } from "react";
import { CheckCircle2, ExternalLink, Lightbulb, XCircle } from "lucide-react";
import { fetchExplanation } from "../services/explanationsService";
import { RichText } from "../utils/richText";
import { cn } from "../lib/cn";
import Button from "./ui/Button";

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
      className={cn(
        "mt-4 rounded-lg border p-6 animate-pop",
        isCorrect ? "border-success/25 bg-success-muted" : "border-error/25 bg-error-muted"
      )}
    >
      <p className={cn("flex items-center gap-2 text-h3", isCorrect ? "text-success" : "text-error")}>
        {isCorrect ? <CheckCircle2 className="h-5 w-5" aria-hidden="true" /> : <XCircle className="h-5 w-5" aria-hidden="true" />}
        {isCorrect ? "Correct" : "Not quite"}
      </p>
      {!isCorrect && (
        <p className="mt-1 text-body-sm text-text-secondary">
          Correct answer: <span className="font-medium text-text-primary">{correctOptionText}</span>
        </p>
      )}

      <div className="mt-4">
        {!explanation && (
          <button
            type="button"
            onClick={handleExplain}
            disabled={isLoadingExplanation}
            className="flex cursor-pointer items-center gap-1.5 text-body-sm font-medium text-primary hover:underline disabled:opacity-50"
          >
            <Lightbulb className="h-4 w-4" aria-hidden="true" />
            {isLoadingExplanation ? "Asking AI tutor…" : "Explain this answer"}
          </button>
        )}
        {explanationError && <p className="mt-2 text-body-sm text-error">{explanationError}</p>}
        {explanation && (
          <div className="mt-2 rounded-md border border-border bg-surface p-4">
            {isExplanationFallback && (
              <p className="mb-1.5 text-caption font-medium text-warning">
                AI tutor is temporarily unavailable — showing a basic explanation.
              </p>
            )}
            <RichText text={explanation} />
          </div>
        )}
      </div>

      {domain && (domain.description || domain.resources?.length > 0) && (
        <div className="mt-4 rounded-md border border-border bg-surface p-4">
          <p className="text-caption font-semibold uppercase tracking-wide text-text-muted">About {domain.name}</p>
          {domain.description && <p className="mt-1 text-body-sm leading-relaxed text-text-secondary">{domain.description}</p>}
          {domain.resources?.length > 0 && (
            <ul className="mt-2 space-y-1">
              {domain.resources.map((resource) => (
                <li key={resource.id}>
                  <a
                    href={resource.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-body-sm font-medium text-primary hover:underline"
                  >
                    {resource.title}
                    <ExternalLink className="h-3 w-3" aria-hidden="true" />
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {!hideNext && (
        <Button variant="secondary" onClick={onNext} className="mt-4 w-full">
          {isLastQuestion ? "Finish session" : "Next question"}
        </Button>
      )}
    </div>
  );
}
