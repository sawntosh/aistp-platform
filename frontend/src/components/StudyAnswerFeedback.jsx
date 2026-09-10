import { useState } from "react";
import { Lightbulb } from "lucide-react";
import { fetchExplanation } from "../services/explanationsService";
import { RichText } from "../utils/richText";
import AnswerReveal from "./question/AnswerReveal";
import Button from "./ui/Button";

export default function StudyAnswerFeedback({
  isCorrect,
  correctAnswerText,
  questionId,
  onReviewConcept,
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
      setExplanationError("Couldn't load an explanation. Try again.");
    } finally {
      setIsLoadingExplanation(false);
    }
  }

  return (
    <AnswerReveal isCorrect={isCorrect} correctAnswerText={correctAnswerText} wrongTone="warning">
      <div>
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
          <div className="mt-1 rounded-md border border-border bg-surface p-4">
            {isExplanationFallback && (
              <p className="mb-1.5 text-caption font-medium text-warning">
                The AI tutor is unavailable right now. Here&apos;s a basic explanation.
              </p>
            )}
            <RichText text={explanation} />
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        {!isCorrect && (
          <Button variant="outline" onClick={onReviewConcept}>
            Review this concept
          </Button>
        )}
        <Button tone="study" onClick={onNext} className="flex-1">
          {isLastQuestion ? "Finish" : "Next question"}
        </Button>
      </div>
    </AnswerReveal>
  );
}
