import { cn } from "../lib/cn";
import { confidenceLabel } from "../lib/confidence";
import ConfidenceSelector from "./ConfidenceSelector";
import QuestionBody from "./question/QuestionBody";
import QuestionMetaBar from "./question/QuestionMetaBar";
import Button from "./ui/Button";

// Whether the current `answer` value is complete enough to submit, per
// question_type. Unchanged rules -- just centralised here and in
// QuestionBody's siblings.
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
  // Exam modes withhold correctness during the session (result stays null),
  // so no right/wrong colouring until the end-of-exam review.
  const revealed = isAnswered && Boolean(result);
  const answerReady = isAnswerReady(question, answer);
  const canSubmit = answerReady && (!confidenceRequired || confidence != null);

  return (
    <div className="rounded-xl border border-border bg-surface p-6">
      <QuestionMetaBar
        question={question}
        showType
        showDifficulty={!isExam}
        showDomain={!isMock}
        flagged={flagged}
        onToggleFlag={onToggleFlag}
      />

      <h2 className="text-h3 font-semibold leading-snug text-text-primary">{question.text}</h2>

      {question.image && (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={question.image}
          alt=""
          className="mt-4 max-h-96 w-full rounded-lg border border-border object-contain"
        />
      )}

      <div className="mt-5">
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
        <div className="mt-5 rounded-lg bg-surface-muted px-4 py-3">
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
  );
}
