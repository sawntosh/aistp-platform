import { Check } from "lucide-react";
import { getDomainColor } from "../utils/domainColors";
import { cn } from "../lib/cn";
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
        const isCorrectOption = isAnswered && correctIds.has(option.id);
        const isWrongSelection = isAnswered && isSelected && !correctIds.has(option.id);

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

function FillBlank({ answer, onAnswerChange, isAnswered, result }) {
  const isWrong = isAnswered && !result?.isCorrect;
  return (
    <div>
      <label htmlFor="test-fill-blank" className="sr-only">
        Your answer
      </label>
      <input
        id="test-fill-blank"
        type="text"
        disabled={isAnswered}
        value={answer ?? ""}
        onChange={(e) => onAnswerChange(e.target.value)}
        placeholder="Type your answer"
        className={cn(
          "w-full rounded-md border px-4 py-3 text-body-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-test",
          isAnswered
            ? result?.isCorrect
              ? "border-success bg-success-muted text-success"
              : "border-error bg-error-muted text-error"
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

  function setPair(pairId, value) {
    if (isAnswered) return;
    onAnswerChange({ ...selections, [pairId]: value });
  }

  return (
    <div className="space-y-2">
      {question.matching_pairs.map((pair) => {
        const selected = selections[pair.id] ?? "";
        const correctText = result?.correctPairing?.[pair.id];
        const isRowCorrect = isAnswered && selected === correctText;
        const isRowWrong = isAnswered && selected && !isRowCorrect;

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
}) {
  if (!question) return null;

  const domainColor = getDomainColor(question.domain?.name);
  const canSubmit = isAnswerReady(question, answer);

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
        <FillBlank answer={answer} onAnswerChange={onAnswerChange} isAnswered={isAnswered} result={result} />
      )}
      {question.question_type === "matching" && (
        <Matching question={question} answer={answer} onAnswerChange={onAnswerChange} isAnswered={isAnswered} result={result} />
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
          <p className="mb-3 rounded-md bg-surface-muted px-4 py-2 text-body-sm text-text-secondary">
            Answer recorded — you&apos;ll see the correct answer and explanation after you finish the test.
          </p>
          <Button variant="secondary" onClick={onNext} className="w-full">
            {isLastQuestion ? "Finish test" : "Next question"}
          </Button>
        </div>
      )}
    </Card>
  );
}
