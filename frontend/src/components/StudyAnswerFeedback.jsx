import { useState } from "react";
import { CheckCircle2, Lightbulb, XCircle } from "lucide-react";
import { fetchExplanation } from "../services/explanationsService";
import { RichText } from "../utils/richText";
import { cn } from "../lib/cn";
import Button from "./ui/Button";

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
      className={cn(
        "mt-4 rounded-lg border p-6 animate-pop",
        isCorrect ? "border-success/25 bg-success-muted" : "border-warning/25 bg-warning-muted"
      )}
    >
      <p className={cn("flex items-center gap-2 text-h3", isCorrect ? "text-success" : "text-warning")}>
        {isCorrect ? <CheckCircle2 className="h-5 w-5" aria-hidden="true" /> : <XCircle className="h-5 w-5" aria-hidden="true" />}
        {isCorrect ? "Correct" : "Not quite"}
      </p>

      {!isCorrect && (
        <p className="mt-2 text-body-sm text-text-secondary">
          The best answer is: <span className="font-medium text-text-primary">{correctAnswerText}</span>
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
            {isLoadingExplanation ? "Asking AI tutor…" : "Why this matters"}
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

      <div className="mt-5 flex flex-col gap-2 sm:flex-row">
        {!isCorrect && (
          <Button variant="outline" onClick={onReviewConcept}>
            Review this concept
          </Button>
        )}
        <Button tone="study" onClick={onNext} className="flex-1">
          {isLastQuestion ? "Finish" : "Next Question"}
        </Button>
      </div>
    </div>
  );
}
