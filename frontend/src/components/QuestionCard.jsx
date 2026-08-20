import { getDomainColor } from "../utils/domainColors";

const DIFFICULTY_STYLE = {
  easy: "bg-emerald-50 text-emerald-700",
  medium: "bg-amber-50 text-amber-700",
  hard: "bg-rose-50 text-rose-700",
};

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
    <div className="space-y-2">
      {question.options.map((option) => {
        const isSelected = isMulti ? (answer ?? []).includes(option.id) : option.id === answer;
        const isCorrectOption = isAnswered && correctIds.has(option.id);
        const isWrongSelection = isAnswered && isSelected && !correctIds.has(option.id);

        return (
          <button
            key={option.id}
            type="button"
            disabled={isAnswered}
            onClick={() => toggle(option.id)}
            className={[
              "flex w-full items-center justify-between gap-3 rounded-lg border px-4 py-3 text-left text-sm transition-all",
              isCorrectOption
                ? "border-green-500 bg-green-50 text-green-800 animate-pop"
                : isWrongSelection
                  ? "border-red-500 bg-red-50 text-red-800 animate-shake"
                  : isSelected
                    ? "border-indigo-500 bg-indigo-50 text-indigo-800"
                    : "border-gray-200 hover:border-gray-300 hover:shadow-sm",
              isAnswered ? "cursor-default" : "cursor-pointer active:scale-[0.99]",
            ].join(" ")}
          >
            <span className="flex items-center gap-2">
              {isMulti && (
                <span
                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                    isSelected ? "border-indigo-600 bg-indigo-600" : "border-gray-300"
                  }`}
                >
                  {isSelected && <span className="h-1.5 w-1.5 rounded-sm bg-white" />}
                </span>
              )}
              <span>{option.text}</span>
            </span>
            {isCorrectOption && (
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5 shrink-0 text-blue-600">
                <path
                  fillRule="evenodd"
                  d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z"
                  clipRule="evenodd"
                />
              </svg>
            )}
          </button>
        );
      })}
      {isMulti && !isAnswered && <p className="text-xs text-gray-400">Select all options that apply.</p>}
    </div>
  );
}

function FillBlank({ answer, onAnswerChange, isAnswered, result }) {
  const isWrong = isAnswered && !result?.isCorrect;
  return (
    <div>
      <input
        type="text"
        disabled={isAnswered}
        value={answer ?? ""}
        onChange={(e) => onAnswerChange(e.target.value)}
        placeholder="Type your answer"
        className={[
          "w-full rounded-lg border px-4 py-3 text-sm",
          isAnswered
            ? result?.isCorrect
              ? "border-green-500 bg-green-50 text-green-800"
              : "border-red-500 bg-red-50 text-red-800"
            : "border-gray-200 focus:border-indigo-400 focus:outline-none",
        ].join(" ")}
      />
      {isWrong && result?.correctAnswer && (
        <p className="mt-2 text-sm text-gray-600">
          Accepted answer: <span className="font-medium text-gray-900">{result.correctAnswer}</span>
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
            className={[
              "flex flex-col gap-2 rounded-lg border px-4 py-3 sm:flex-row sm:items-center sm:justify-between",
              isRowCorrect ? "border-green-500 bg-green-50" : isRowWrong ? "border-red-500 bg-red-50" : "border-gray-200",
            ].join(" ")}
          >
            <span className="text-sm font-medium text-gray-900">{pair.prompt_text}</span>
            <select
              disabled={isAnswered}
              value={selected}
              onChange={(e) => setPair(pair.id, e.target.value)}
              className="rounded-md border border-gray-200 px-3 py-2 text-sm sm:w-64"
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
            {isRowWrong && correctText && <span className="text-xs text-gray-600 sm:hidden">Correct: {correctText}</span>}
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
}) {
  if (!question) return null;

  const domainColor = getDomainColor(question.domain?.name);
  const canSubmit = isAnswerReady(question, answer);

  return (
    <div className="bg-white rounded-xl shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <span
          className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${domainColor.bg} ${domainColor.text}`}
        >
          {question.domain?.name}
        </span>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium uppercase tracking-wide ${
            DIFFICULTY_STYLE[question.difficulty] ?? "bg-gray-100 text-gray-500"
          }`}
        >
          {question.difficulty}
        </span>
      </div>

      <p className="text-lg font-medium text-gray-900 mb-6">{question.text}</p>

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
        <div className="mt-4 flex gap-3">
          {canSkip && (
            <button
              type="button"
              onClick={onSkip}
              disabled={isSubmitting}
              title="Come back to this question after the others"
              className="rounded-md border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 transition-all hover:bg-gray-50 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Skip for now
            </button>
          )}
          <button
            type="button"
            onClick={onSubmit}
            disabled={!canSubmit || isSubmitting}
            className="flex-1 rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white transition-all hover:bg-indigo-500 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? "Submitting…" : "Submit answer"}
          </button>
        </div>
      )}
    </div>
  );
}
