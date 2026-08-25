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
            className={[
              "flex w-full items-center justify-between gap-3 rounded-lg border px-4 py-3 text-left text-sm transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500",
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
              <span aria-hidden="true" className="font-medium text-gray-400">
                {letter}.
              </span>
              <span>{option.text}</span>
            </span>
            {isCorrectOption && (
              <span aria-hidden="true" className="text-green-600">
                ✓
              </span>
            )}
            {isWrongSelection && (
              <span aria-hidden="true" className="text-red-600">
                ✕
              </span>
            )}
          </button>
        );
      })}
      {isMulti && !isAnswered && <p className="text-xs text-gray-400">Select all options that apply.</p>}
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
        className={[
          "w-full rounded-lg border px-4 py-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500",
          isAnswered
            ? result?.isCorrect
              ? "border-green-500 bg-green-50 text-green-800"
              : "border-red-500 bg-red-50 text-red-800"
            : "border-gray-200",
        ].join(" ")}
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
            className={[
              "flex flex-col gap-2 rounded-lg border px-4 py-3 sm:flex-row sm:items-center sm:justify-between",
              isRowCorrect ? "border-green-500 bg-green-50" : isRowWrong ? "border-red-500 bg-red-50" : "border-gray-200",
            ].join(" ")}
          >
            <span className="text-sm font-medium text-gray-900">{pair.prompt_text}</span>
            <label className="sr-only" htmlFor={`study-match-${pair.id}`}>
              Match for {pair.prompt_text}
            </label>
            <select
              id={`study-match-${pair.id}`}
              disabled={isAnswered}
              value={selected}
              onChange={(e) => setPair(pair.id, e.target.value)}
              className="rounded-md border border-gray-200 px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 sm:w-64"
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
    <div className="rounded-xl bg-white p-6 shadow">
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-indigo-500">
        Question {questionNumber} of {totalQuestions}
      </p>
      <h2 className="mb-6 text-lg font-medium text-gray-900">{question.text}</h2>

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
        <button
          type="button"
          onClick={onCheck}
          disabled={!canCheck || isChecking}
          className="mt-5 w-full rounded-md bg-indigo-600 px-3 py-2.5 text-sm font-medium text-white transition-all hover:bg-indigo-500 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:px-6"
        >
          {isChecking ? "Checking…" : "Check Answer"}
        </button>
      )}
    </div>
  );
}
