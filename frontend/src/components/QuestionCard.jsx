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
  isAnswered,
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
                "w-full text-left rounded-lg border px-4 py-3 text-sm transition-all",
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
              {option.text}
            </button>
          );
        })}
      </div>
    </div>
  );
}
