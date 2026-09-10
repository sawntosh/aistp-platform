import { Flag } from "lucide-react";
import { cn } from "../lib/cn";
import { confidenceLabel } from "../lib/confidence";
import ConfidenceSelector from "./ConfidenceSelector";
import QuestionBody from "./question/QuestionBody";
import Button from "./ui/Button";

const TYPE_LABEL = {
  mcq: "Multiple choice",
  true_false: "True / False",
  multi_select: "Multiple answer",
  fill_blank: "Short answer",
  matching: "Matching",
};

// Whether the current `answer` value is complete enough to submit, per
// question_type. Unchanged rules.
function isAnswerReady(question, answer) {
  const qtype = question.question_type;
  if (qtype === "multi_select") return Array.isArray(answer) && answer.length > 0;
  if (qtype === "fill_blank") return typeof answer === "string" && answer.trim().length > 0;
  if (qtype === "matching") {
    return (
      answer &&
      typeof answer === "object" &&
      question.matching_pairs.every((pair) => Boolean(answer[pair.id]))
    );
  }
  return answer !== null && answer !== undefined;
}

export default function QuestionCard({
  question,
  questionNumber,
  answer,
  onAnswerChange,
  onSubmit,
  onSkip,
  onEdit,
  onNext,
  canSkip = false,
  isAnswered,
  isSubmitting,
  result,
  mode,
  isLastQuestion,
  hideAdvance = false,
  confidence = null,
  onConfidenceChange,
  confidenceRequired = false,
  flagged = false,
  onToggleFlag,
}) {
  if (!question) return null;

  const isMock = mode === "mock";
  const isExam = mode === "test" || isMock;
  const revealed = isAnswered && Boolean(result);
  const answerReady = isAnswerReady(question, answer);
  const canSubmit = answerReady && (!confidenceRequired || confidence != null);

  let status = { text: "Not yet answered", className: "text-text-muted" };
  if (revealed) {
    status = result.isCorrect
      ? { text: "Correct", className: "text-success font-medium" }
      : { text: "Incorrect", className: "text-error font-medium" };
  } else if (isAnswered) {
    status = { text: "Answer saved", className: "text-text-secondary" };
  }

  return (
    <div className="rounded-lg border border-border bg-surface">
      {/* Moodle-style status header */}
      <header className="flex items-start justify-between gap-3 border-b border-border bg-surface-muted/40 px-5 py-2.5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-caption">
          {questionNumber != null && (
            <span className="font-semibold text-text-primary">Question {questionNumber}</span>
          )}
          <span className={status.className}>{status.text}</span>
          <span className="text-text-muted">
            {TYPE_LABEL[question.question_type] ?? question.question_type} · Marked out of 1.00
          </span>
        </div>

        {onToggleFlag && (
          <button
            type="button"
            onClick={onToggleFlag}
            aria-pressed={flagged}
            className={cn(
              "flex shrink-0 items-center gap-1 text-caption font-medium transition-colors",
              flagged ? "text-warning" : "text-text-muted hover:text-text-secondary"
            )}
          >
            <Flag className={cn("h-3.5 w-3.5", flagged && "fill-current")} aria-hidden="true" />
            {flagged ? "Flagged" : "Flag question"}
          </button>
        )}
      </header>

      <div className="p-5">
        <p className="text-body font-medium leading-relaxed text-text-primary">{question.text}</p>

        {question.image && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={question.image}
            alt=""
            className="mt-3 max-h-96 w-full rounded-md border border-border object-contain"
          />
        )}

        <div className="mt-4">
          <QuestionBody
            question={question}
            answer={answer}
            onAnswerChange={onAnswerChange}
            disabled={isAnswered}
            revealed={revealed}
            result={result}
            accent="test"
          />
        </div>

        {!isAnswered && confidenceRequired && answerReady && (
          <ConfidenceSelector
            value={confidence}
            onChange={onConfidenceChange}
            disabled={isSubmitting}
            idPrefix={`confidence-${question.id}`}
          />
        )}

        {!isAnswered && (
          <div className="mt-5 flex gap-3">
            {canSkip && (
              <Button
                variant="outline"
                onClick={onSkip}
                disabled={isSubmitting}
                title="Come back to this question after the others"
              >
                Skip for now
              </Button>
            )}
            <Button
              tone="test"
              onClick={onSubmit}
              disabled={!canSubmit}
              isLoading={isSubmitting}
              className="flex-1"
            >
              {isExam
                ? isSubmitting
                  ? "Saving…"
                  : "Save answer"
                : isSubmitting
                  ? "Submitting…"
                  : "Submit answer"}
            </Button>
          </div>
        )}

        {isAnswered && isExam && (
          <div className="mt-5 rounded-md bg-surface-muted px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-body-sm text-text-secondary">
                Answer saved. You&apos;ll see the correct answer and explanation after you submit.
              </p>
              {onEdit && (
                <Button variant="outline" tone="test" size="sm" onClick={onEdit}>
                  Change answer
                </Button>
              )}
            </div>
            {confidence != null && (
              <p className="mt-2 text-caption text-text-muted">
                Your confidence:{" "}
                <span className="font-medium text-text-secondary">
                  {confidence} — {confidenceLabel(confidence)}
                </span>
              </p>
            )}
            {!hideAdvance && (
              <Button variant="secondary" onClick={onNext} className="mt-3 w-full">
                {isLastQuestion ? "Submit exam" : "Next question"}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
