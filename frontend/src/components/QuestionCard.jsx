export default function QuestionCard({
  question,
  selectedOptionId,
  onSelectOption,
  isAnswered,
  correctOptionId,
}) {
  if (!question) return null;

  return (
    <div className="bg-white rounded-xl shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <span className="inline-block rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700">
          {question.domain}
        </span>
        <span className="text-xs uppercase tracking-wide text-gray-400">
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
                "w-full text-left rounded-lg border px-4 py-3 text-sm transition",
                isCorrectOption
                  ? "border-green-500 bg-green-50 text-green-800"
                  : isWrongSelection
                    ? "border-red-500 bg-red-50 text-red-800"
                    : isSelected
                      ? "border-indigo-500 bg-indigo-50 text-indigo-800"
                      : "border-gray-200 hover:border-gray-300",
                isAnswered ? "cursor-default" : "cursor-pointer",
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
