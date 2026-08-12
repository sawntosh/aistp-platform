import { getDomainColor } from "../utils/domainColors";

const DIFFICULTY_STYLE = {
  easy: "bg-emerald-50 text-emerald-700",
  medium: "bg-amber-50 text-amber-700",
  hard: "bg-rose-50 text-rose-700",
};

export default function QuestionCard({
  question,
  selectedOptionId,
  onSelectOption,
  onSubmit,
  isAnswered,
  isSubmitting,
  correctOptionId,
}) {
  if (!question) return null;

  const domainColor = getDomainColor(question.domain?.name);

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

      <div className="space-y-2">
        {question.options.map((option) => {
          const isSelected = option.id === selectedOptionId;
          const isCorrectOption = isAnswered && option.id === correctOptionId;
          const isWrongSelection = isAnswered && isSelected && option.id !== correctOptionId;

          return (
            <button
              key={option.id}
              type="button"
              disabled={isAnswered}
              onClick={() => onSelectOption(option.id)}
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
              <span>{option.text}</span>
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
      </div>

      {!isAnswered && (
        <button
          type="button"
          onClick={onSubmit}
          disabled={!selectedOptionId || isSubmitting}
          className="mt-4 w-full rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white transition-all hover:bg-indigo-500 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSubmitting ? "Submitting…" : "Submit answer"}
        </button>
      )}
    </div>
  );
}
