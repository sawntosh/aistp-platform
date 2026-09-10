import { useState } from "react";
import { ExternalLink, Lightbulb } from "lucide-react";
import { fetchExplanation } from "../services/explanationsService";
import { RichText } from "../utils/richText";
import AnswerReveal from "./question/AnswerReveal";
import Button from "./ui/Button";

// Post-submit feedback for Practice Mode (inline, per question) and the
// end-of-exam review. The verdict + accepted answer come from the shared
// AnswerReveal; the AI explanation and domain resources hang below it.
// `hideExplain` is set on the live runner, where the "Ask AI to explain"
// side panel owns that action instead.
export default function FeedbackPanel({
  isCorrect,
  correctOptionText,
  questionId,
  domain,
  onNext,
  isLastQuestion,
  hideNext = false,
  hideExplain = false,
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

  const hasResources = domain && (domain.description || domain.resources?.length > 0);

  return (
    <AnswerReveal
      isCorrect={isCorrect}
      correctAnswerText={correctOptionText}
      relatedLabel={domain?.name}
    >
      {!hideExplain && (
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
      )}

      {hasResources && (
        <div className="mt-3 rounded-md border border-border bg-surface p-4">
          <p className="text-caption font-semibold uppercase tracking-wide text-text-muted">
            About {domain.name}
          </p>
          {domain.description && (
            <p className="mt-1 text-body-sm leading-relaxed text-text-secondary">
              {domain.description}
            </p>
          )}
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
        <Button variant="secondary" onClick={onNext} className="mt-3 w-full">
          {isLastQuestion ? "Finish session" : "Next question"}
        </Button>
      )}
    </AnswerReveal>
  );
}
