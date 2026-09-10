import { cn } from "../../lib/cn";
import ChoiceOption from "./ChoiceOption";

// The answer-input surface for a question, dispatched on question_type.
// Shared by the exam/practice runner (QuestionCard) and Study Mode
// (StudyQuestion). Owns NO submission logic -- `answer` / `onAnswerChange`
// carry the same value shapes the services already expect:
//   mcq / true_false -> optionId (number)
//   multi_select     -> number[]
//   fill_blank       -> string
//   matching         -> { [pairId]: matchText }
// `revealed` + `result` (camelCase reveal payload, or null) drive the
// post-submit right/wrong styling; `disabled` locks the inputs.
const CHOICE_TYPES = new Set(["mcq", "true_false", "multi_select"]);

function letterFor(index) {
  return String.fromCharCode(97 + index); // a, b, c, …
}

function ChoiceInput({ question, answer, onAnswerChange, disabled, revealed, result, accent }) {
  const isMulti = question.question_type === "multi_select";
  const selectedIds = isMulti
    ? new Set(Array.isArray(answer) ? answer : [])
    : new Set(answer != null ? [answer] : []);
  const hasSelection = isMulti ? selectedIds.size > 0 : answer != null;

  const correctIds = revealed
    ? new Set(isMulti ? result?.correctOptionIds ?? [] : [result?.correctOptionId])
    : null;

  function toggle(optionId) {
    if (disabled) return;
    if (isMulti) {
      const current = Array.isArray(answer) ? answer : [];
      onAnswerChange(
        current.includes(optionId)
          ? current.filter((id) => id !== optionId)
          : [...current, optionId]
      );
    } else {
      onAnswerChange(optionId);
    }
  }

  function clearChoice() {
    if (disabled) return;
    onAnswerChange(isMulti ? [] : null);
  }

  return (
    <div>
      <div role={isMulti ? "group" : "radiogroup"} className="space-y-0.5">
        {question.options.map((option, index) => {
          const isSelected = selectedIds.has(option.id);
          let state = null;
          if (revealed && correctIds) {
            if (correctIds.has(option.id)) state = "correct";
            else if (isSelected) state = "wrong";
          }
          return (
            <ChoiceOption
              key={option.id}
              letter={letterFor(index)}
              control={isMulti ? "checkbox" : "radio"}
              accent={accent}
              selected={isSelected}
              disabled={disabled}
              state={state}
              onSelect={() => toggle(option.id)}
            >
              {option.text}
            </ChoiceOption>
          );
        })}
      </div>

      {isMulti && !disabled && (
        <p className="mt-1.5 text-caption text-text-muted">Select every option that applies.</p>
      )}

      {!disabled && hasSelection && (
        <button
          type="button"
          onClick={clearChoice}
          className="mt-2 text-caption font-medium text-primary hover:underline"
        >
          Clear my choice
        </button>
      )}
    </div>
  );
}

const SHORT_ANSWER_MAX = 255; // mirrors Attempt.text_answer varchar(255)

function ShortAnswerInput({ question, answer, onAnswerChange, disabled, revealed, result, accent }) {
  const value = typeof answer === "string" ? answer : "";
  const inputId = `short-answer-${question.id}`;
  const ring = accent === "study" ? "focus-visible:outline-study" : "focus-visible:outline-test";
  const outcome = revealed
    ? result?.isCorrect
      ? "border-success bg-success-muted/60 text-success"
      : "border-error bg-error-muted/60 text-error"
    : disabled
      ? "border-border-strong bg-surface-muted text-text-secondary"
      : "border-border-strong bg-surface text-text-primary";

  return (
    <div>
      <label htmlFor={inputId} className="flex items-center gap-2 text-body-sm text-text-secondary">
        <span className="font-medium text-text-primary">Answer:</span>
        <input
          id={inputId}
          type="text"
          disabled={disabled}
          value={value}
          maxLength={SHORT_ANSWER_MAX}
          onChange={(e) => onAnswerChange(e.target.value)}
          className={cn(
            "min-w-0 flex-1 rounded-md border px-3 py-1.5 text-body-sm transition-colors",
            "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
            ring,
            outcome
          )}
        />
      </label>
      {revealed && !result?.isCorrect && result?.correctAnswer && (
        <p className="mt-1.5 text-caption text-text-muted">
          Accepted answer:{" "}
          <span className="font-medium text-text-secondary">{result.correctAnswer}</span>
        </p>
      )}
    </div>
  );
}

function MatchingInput({ question, answer, onAnswerChange, disabled, revealed, result, accent }) {
  const selections = answer && typeof answer === "object" ? answer : {};
  const ring = accent === "study" ? "focus-visible:outline-study" : "focus-visible:outline-test";

  function setPair(pairId, matchText) {
    if (disabled) return;
    onAnswerChange({ ...selections, [pairId]: matchText });
  }

  return (
    <div>
      <div className="divide-y divide-border rounded-md border border-border">
        {question.matching_pairs.map((pair) => {
          const chosen = selections[pair.id] ?? "";
          const correctText = result?.correctPairing?.[pair.id];
          const rowState =
            revealed && correctText != null
              ? chosen === correctText
                ? "correct"
                : chosen
                  ? "wrong"
                  : "missed"
              : null;
          return (
            <div
              key={pair.id}
              className={cn(
                "flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between",
                rowState === "correct"
                  ? "bg-success-muted/50"
                  : rowState === "wrong"
                    ? "bg-error-muted/50"
                    : ""
              )}
            >
              <span className="text-body-sm text-text-primary">{pair.prompt_text}</span>
              <label className="sr-only" htmlFor={`match-${pair.id}`}>
                Match for {pair.prompt_text}
              </label>
              <select
                id={`match-${pair.id}`}
                disabled={disabled}
                value={chosen}
                onChange={(e) => setPair(pair.id, e.target.value)}
                className={cn(
                  "min-w-[12rem] rounded-md border border-border-strong bg-surface px-2.5 py-1.5 text-body-sm",
                  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
                  ring,
                  disabled && "opacity-80"
                )}
              >
                <option value="" disabled>
                  Choose…
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
      {revealed && !result?.isCorrect && (
        <p className="mt-1.5 text-caption text-text-muted">
          Correct pairing:{" "}
          {question.matching_pairs
            .map((p) => `${p.prompt_text} → ${result?.correctPairing?.[p.id] ?? "—"}`)
            .join("  ·  ")}
        </p>
      )}
    </div>
  );
}

export default function QuestionBody({
  question,
  answer,
  onAnswerChange,
  disabled = false,
  revealed = false,
  result = null,
  accent = "test",
}) {
  const shared = { question, answer, onAnswerChange, disabled, revealed, result, accent };

  if (CHOICE_TYPES.has(question.question_type)) return <ChoiceInput {...shared} />;
  if (question.question_type === "fill_blank") return <ShortAnswerInput {...shared} />;
  if (question.question_type === "matching") return <MatchingInput {...shared} />;
  return null;
}
