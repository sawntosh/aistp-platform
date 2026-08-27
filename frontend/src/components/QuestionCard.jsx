import { Check } from "lucide-react";
import { getDomainColor } from "../utils/domainColors";
import { cn } from "../lib/cn";
import { confidenceLabel } from "../lib/confidence";
import ConfidenceSelector from "./ConfidenceSelector";
import Button from "./ui/Button";
import Badge from "./ui/Badge";
import { Card } from "./ui/Card";

const DIFFICULTY_TONE = { easy: "success", medium: "warning", hard: "error" };

const OPTION_TYPES = new Set(["mcq", "true_false", "multi_select"]);

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

function OptionList({ question, answer, onAnswerChange, isAnswered, result }) {
  const isMulti = question.question_type === "multi_select";
  // Test Mode submits without a result -- the answer is locked but
  // correctness stays hidden until the end-of-test review.
  const revealed = isAnswered && Boolean(result);

  function toggle(optionId) {
    if (isAnswered) return;
    if (isMulti) {
      const current = Array.isArray(answer) ? answer : [];
      onAnswerChange(
        current.includes(optionId) ? current.filter((id) => id !== optionId) : [...current, optionId]
      );
    } else {
      onAnswerChange(optionId);
    }
  }

  const correctIds = isMulti ? new Set(result?.correctOptionIds ?? []) : new Set([result?.correctOptionId]);

  return (
    <fieldset className="space-y-2">
      <legend className="sr-only">Answer options</legend>
      {question.options.map((option) => {
        const isSelected = isMulti ? (answer ?? []).includes(option.id) : option.id === answer;
        const isCorrectOption = revealed && correctIds.has(option.id);
        const isWrongSelection = revealed && isSelected && !correctIds.has(option.id);

        return (
          <button
            key={option.id}
            type="button"
            role={isMulti ? "checkbox" : "radio"}
            aria-checked={isSelected}
            disabled={isAnswered}
            onClick={() => toggle(option.id)}
            className={cn(
              "flex w-full items-center justify-between gap-3 rounded-md border px-4 py-3 text-left text-body-sm transition-all duration-150",
              "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-test",
              isCorrectOption
                ? "border-success bg-success-muted text-success animate-pop"
                : isWrongSelection
                  ? "border-error bg-error-muted text-error animate-shake"
                  : isSelected
                    ? "border-test bg-test-muted text-test"
                    : "border-border hover:border-border-strong hover:bg-surface-muted",
              isAnswered ? "cursor-default" : "cursor-pointer"
            )}
          >
            <span className="flex items-center gap-2">
              {isMulti && (
                <span
                  className={cn(
                    "flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border",
                    isSelected ? "border-test bg-test" : "border-border-strong"
                  )}
                >
                  {isSelected && <span className="h-1.5 w-1.5 rounded-sm bg-white" />}
                </span>
              )}
              <span>{option.text}</span>
            </span>
            {isCorrectOption && <Check className="h-4 w-4 shrink-0" aria-hidden="true" />}
          </button>
        );
      })}
      {isMulti && !isAnswered && <p className="text-caption text-text-muted">Select all options that apply.</p>}
    </fieldset>
  );
}

function FillBlank({ questionId, answer, onAnswerChange, isAnswered, result }) {
  // Test Mode locks the field on submit but withholds correctness until
  // the end-of-test review, so only colour it once `result` is present.
  const revealed = isAnswered && Boolean(result);
  const isWrong = revealed && !result.isCorrect;
  const inputId = `fill-blank-${questionId ?? "current"}`;
  return (
    <div>
      <label htmlFor={inputId} className="sr-only">
        Your answer
      </label>
      <input
        id={inputId}
        type="text"
        disabled={isAnswered}
        value={answer ?? ""}
        onChange={(e) => onAnswerChange(e.target.value)}
        placeholder="Type your answer"
        className={cn(
          "w-full rounded-md border px-4 py-3 text-body-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-test",
          revealed
            ? result.isCorrect
              ? "border-success bg-success-muted text-success"
              : "border-error bg-error-muted text-error"
            : isAnswered
              ? "border-border-strong bg-surface-muted text-text-secondary"
              : "border-border-strong bg-surface"
        )}
      />
      {isWrong && result?.correctAnswer && (
        <p className="mt-2 text-body-sm text-text-secondary">
          Accepted answer: <span className="font-medium text-text-primary">{result.correctAnswer}</span>
        </p>
      )}
    </div>
  );
}

function Matching({ question, answer, onAnswerChange, isAnswered, result }) {
  const selections = answer ?? {};
  // Test Mode locks the selects on submit but withholds correctness until
  // the end-of-test review, so only mark rows once `result` is present.
  const revealed = isAnswered && Boolean(result);

  function setPair(pairId, value) {
    if (isAnswered) return;
    onAnswerChange({ ...selections, [pairId]: value });
  }

  return (
    <div className="space-y-2">
      {question.matching_pairs.map((pair) => {
        const selected = selections[pair.id] ?? "";
        const correctText = result?.correctPairing?.[pair.id];
        const isRowCorrect = revealed && selected === correctText;
        const isRowWrong = revealed && selected && !isRowCorrect;

        return (
          <div
            key={pair.id}
            className={cn(
              "flex flex-col gap-2 rounded-md border px-4 py-3 sm:flex-row sm:items-center sm:justify-between",
              isRowCorrect ? "border-success bg-success-muted" : isRowWrong ? "border-error bg-error-muted" : "border-border"
            )}
          >
            <span className="text-body-sm font-medium text-text-primary">{pair.prompt_text}</span>
            <select
              disabled={isAnswered}
              value={selected}
              onChange={(e) => setPair(pair.id, e.target.value)}
              className="rounded-md border border-border-strong bg-surface px-3 py-2 text-body-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-test sm:w-64"
            >
              <option value="" disabled>
                Choose a match…
              </option>
              {question.match_choices.map((choice) => (
                <option key={choice} value={choice}>
                  {choice}
                </option>
              ))}
            </select>
            {isRowWrong && correctText && <span className="text-caption text-text-secondary sm:hidden">Correct: {correctText}</span>}
          </div>
        );
      })}
    </div>
  );
}

export default function QuestionCard({
  question,
  answer,
  onAnswerChange,
  onSubmit,
  onSkip,
  canSkip,
  isAnswered,
  isSubmitting,
  result,
  mode,
  onNext,
  isLastQuestion,
  hideAdvance = false,
  confidence = null,
  onConfidenceChange,
  confidenceRequired = false,
}) {
  if (!question) return null;

  const domainColor = getDomainColor(question.domain?.name);
  const answerReady = isAnswerReady(question, answer);
  // Test Mode: an answer alone isn't enough -- the learner must also
  // rate their confidence before the answer can be submitted.
  const canSubmit = answerReady && (!confidenceRequired || confidence != null);

  return (
    <Card className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <span className={cn("inline-block rounded-full px-3 py-1 text-caption font-medium", domainColor.bg, domainColor.text)}>
          {question.domain?.name}
        </span>
        <Badge tone={DIFFICULTY_TONE[question.difficulty] ?? "default"} className="uppercase">
          {question.difficulty}
        </Badge>
      </div>

      <p className="mb-6 text-h3 font-normal text-text-primary">{question.text}</p>

      {OPTION_TYPES.has(question.question_type) && (
        <OptionList question={question} answer={answer} onAnswerChange={onAnswerChange} isAnswered={isAnswered} result={result} />
      )}
      {question.question_type === "fill_blank" && (
        <FillBlank
          questionId={question.id}
          answer={answer}
          onAnswerChange={onAnswerChange}
          isAnswered={isAnswered}
          result={result}
        />
      )}
      {question.question_type === "matching" && (
        <Matching question={question} answer={answer} onAnswerChange={onAnswerChange} isAnswered={isAnswered} result={result} />
      )}

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
            <Button variant="outline" onClick={onSkip} disabled={isSubmitting} title="Come back to this question after the others">
              Skip for now
            </Button>
          )}
          <Button tone="test" onClick={onSubmit} disabled={!canSubmit} isLoading={isSubmitting} className="flex-1">
            {isSubmitting ? "Submitting…" : "Submit answer"}
          </Button>
        </div>
      )}

      {isAnswered && mode === "test" && (
        <div className="mt-5">
          <p className="rounded-md bg-surface-muted px-4 py-2 text-body-sm text-text-secondary">
            Answer recorded — you&apos;ll see the correct answer and explanation after you finish the test.
          </p>
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
              {isLastQuestion ? "Finish test" : "Next question"}
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}
