import { Check, X } from "lucide-react";
import { cn } from "../lib/cn";
import Button from "./ui/Button";
import { Card } from "./ui/Card";

const OPTION_TYPES = new Set(["mcq", "true_false", "multi_select"]);

function isAnswerReady(question, answer) {
  const qtype = question.question_type;
  if (qtype === "multi_select") return Array.isArray(answer) && answer.length > 0;
  if (qtype === "fill_blank") return typeof answer === "string" && answer.trim().length > 0;
  if (qtype === "matching") {
    return answer && typeof answer === "object" && question.matching_pairs.every((pair) => Boolean(answer[pair.id]));
  }
  return answer !== null && answer !== undefined;
}

function OptionList({ question, answer, onAnswerChange, isAnswered, result }) {
  const isMulti = question.question_type === "multi_select";

  function toggle(optionId) {
    if (isAnswered) return;
    if (isMulti) {
      const current = Array.isArray(answer) ? answer : [];
      onAnswerChange(current.includes(optionId) ? current.filter((id) => id !== optionId) : [...current, optionId]);
    } else {
      onAnswerChange(optionId);
    }
  }

  const correctIds = isMulti ? new Set(result?.correctOptionIds ?? []) : new Set([result?.correctOptionId]);

  return (
    <fieldset className="space-y-2">
      <legend className="sr-only">Answer options</legend>
      {question.options.map((option, index) => {
        const isSelected = isMulti ? (answer ?? []).includes(option.id) : option.id === answer;
        const isCorrectOption = isAnswered && correctIds.has(option.id);
        const isWrongSelection = isAnswered && isSelected && !correctIds.has(option.id);
        const letter = String.fromCharCode(65 + index);

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
              "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-study",
              isCorrectOption
                ? "border-success bg-success-muted text-success animate-pop"
                : isWrongSelection
                  ? "border-error bg-error-muted text-error animate-shake"
                  : isSelected
                    ? "border-study bg-study-muted text-study"
                    : "border-border hover:border-border-strong hover:bg-surface-muted",
              isAnswered ? "cursor-default" : "cursor-pointer"
            )}
          >
            <span className="flex items-center gap-2">
              <span aria-hidden="true" className="font-medium text-text-muted">
                {letter}.
              </span>
              <span>{option.text}</span>
            </span>
            {isCorrectOption && <Check className="h-4 w-4 shrink-0" aria-hidden="true" />}
            {isWrongSelection && <X className="h-4 w-4 shrink-0" aria-hidden="true" />}
          </button>
        );
      })}
      {isMulti && !isAnswered && <p className="text-caption text-text-muted">Select all options that apply.</p>}
    </fieldset>
  );
}

function FillBlank({ answer, onAnswerChange, isAnswered, result }) {
  return (
    <div>
      <label htmlFor="study-fill-blank" className="sr-only">
        Your answer
      </label>
      <input
        id="study-fill-blank"
        type="text"
        disabled={isAnswered}
        value={answer ?? ""}
        onChange={(e) => onAnswerChange(e.target.value)}
        placeholder="Type your answer"
        className={cn(
          "w-full rounded-md border px-4 py-3 text-body-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-study",
          isAnswered
            ? result?.isCorrect
              ? "border-success bg-success-muted text-success"
              : "border-error bg-error-muted text-error"
            : "border-border-strong bg-surface"
        )}
      />
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
            <label className="sr-only" htmlFor={`study-match-${pair.id}`}>
              Match for {pair.prompt_text}
            </label>
            <select
              id={`study-match-${pair.id}`}
              disabled={isAnswered}
              value={selected}
              onChange={(e) => setPair(pair.id, e.target.value)}
              className="rounded-md border border-border-strong bg-surface px-3 py-2 text-body-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-study sm:w-64"
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
          </div>
        );
      })}
    </div>
  );
}

export default function StudyQuestion({
  question,
  questionNumber,
  totalQuestions,
  answer,
  onAnswerChange,
  onCheck,
  isChecking,
  isAnswered,
  result,
}) {
  if (!question) return null;
  const canCheck = isAnswerReady(question, answer);

  return (
    <Card className="p-6">
      <p className="mb-1 text-label uppercase tracking-wide text-study">
        Knowledge Check &middot; Question {questionNumber} of {totalQuestions}
      </p>
      <h2 className="mb-6 text-h3 font-normal text-text-primary">{question.text}</h2>

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
        <Button tone="study" onClick={onCheck} disabled={!canCheck} isLoading={isChecking} className="mt-5 w-full sm:w-auto">
          {isChecking ? "Checking…" : "Check Answer"}
        </Button>
      )}
    </Card>
  );
}
