import { cn } from "../../lib/cn";
import ChoiceOption from "./ChoiceOption";

// The answer-input surface for a question, dispatched on question_type.
// Shared by the exam/practice runner (QuestionCard) and Study Mode
// (StudyQuestion) so the five supported types render identically
// everywhere. It owns NO submission logic -- `answer` / `onAnswerChange`
// carry the same value shapes the services already expect:
//   mcq / true_false -> optionId (number)
//   multi_select     -> number[]
//   fill_blank       -> string
//   matching         -> { [pairId]: matchText }
// `revealed` + `result` (camelCase reveal payload, or null) drive the
// post-submit right/wrong colouring; `disabled` locks the inputs.
const CHOICE_TYPES = new Set(["mcq", "true_false", "multi_select"]);

function letterFor(index) {
  return String.fromCharCode(65 + index);
}

function ChoiceInput({ question, answer, onAnswerChange, disabled, revealed, result, accent }) {
  const isMulti = question.question_type === "multi_select";
  const selectedIds = isMulti
    ? new Set(Array.isArray(answer) ? answer : [])
    : new Set(answer != null ? [answer] : []);

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

  return (
    <div role={isMulti ? "group" : "radiogroup"} className="space-y-2.5">
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
      {isMulti && !disabled && (
        <p className="pt-0.5 text-caption text-text-muted">Select every option that applies.</p>
      )}
    </div>
  );
}

const SHORT_ANSWER_MAX = 255; // mirrors Attempt.text_answer varchar(255)

function ShortAnswerInput({ question, answer, onAnswerChange, disabled, revealed, result, accent }) {
  const value = typeof answer === "string" ? answer : "";
  const inputId = `short-answer-${question.id}`;
  const outcome = revealed
    ? result?.isCorrect
      ? "border-success bg-success-muted text-success"
      : "border-error bg-error-muted text-error"
    : disabled
      ? "border-border-strong bg-surface-muted text-text-secondary"
      : cn(
          "border-border-strong bg-surface text-text-primary",
          accent === "study" ? "focus-visible:outline-study" : "focus-visible:outline-test"
        );

  return (
    <div>
      <label htmlFor={inputId} className="sr-only">
        Your answer
      </label>
      <textarea
        id={inputId}
        rows={2}
        disabled={disabled}
        value={value}
        maxLength={SHORT_ANSWER_MAX}
        onChange={(e) => onAnswerChange(e.target.value)}
        placeholder="Type your answer"
        className={cn(
          "w-full resize-y rounded-lg border px-4 py-3 text-body-sm transition-colors",
          "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
          outcome
        )}
      />
      <div className="mt-1 flex items-center justify-between text-caption text-text-muted">
        <span>
          {revealed && !result?.isCorrect && result?.correctAnswer ? (
            <>
              Accepted answer:{" "}
              <span className="font-medium text-text-secondary">{result.correctAnswer}</span>
            </>
          ) : (
            "Answer is checked ignoring case and extra spaces."
          )}
        </span>
        <span className="tabular-nums">
          {value.length} / {SHORT_ANSWER_MAX}
        </span>
      </div>
    </div>
  );
}

function MatchingInput({ question, answer, onAnswerChange, disabled, revealed, result, accent }) {
  const selections = answer && typeof answer === "object" ? answer : {};
  const ringClass = accent === "study" ? "focus-visible:outline-study" : "focus-visible:outline-test";

  function setPair(pairId, matchText) {
    if (disabled) return;
    onAnswerChange({ ...selections, [pairId]: matchText });
  }

  return (
    <div className="space-y-2.5">
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
              "flex flex-col gap-2 rounded-lg border px-4 py-3 sm:flex-row sm:items-center sm:justify-between",
              rowState === "correct"
                ? "border-success bg-success-muted"
                : rowState === "wrong"
                  ? "border-error bg-error-muted"
                  : "border-border bg-surface"
            )}
          >
            <span className="text-body-sm font-medium text-text-primary">{pair.prompt_text}</span>
            <div className="flex items-center gap-2">
              <label className="sr-only" htmlFor={`match-${pair.id}`}>
                Match for {pair.prompt_text}
              </label>
              <select
                id={`match-${pair.id}`}
                disabled={disabled}
                value={chosen}
                onChange={(e) => setPair(pair.id, e.target.value)}
                className={cn(
                  "min-w-[12rem] rounded-md border border-border-strong bg-surface px-3 py-2 text-body-sm",
                  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
                  ringClass,
                  disabled && "opacity-80"
                )}
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
            {rowState === "wrong" && correctText && (
              <span className="text-caption text-text-secondary sm:hidden">
                Correct: {correctText}
              </span>
            )}
          </div>
        );
      })}
      {revealed && !result?.isCorrect && (
        <p className="text-caption text-text-secondary">
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
