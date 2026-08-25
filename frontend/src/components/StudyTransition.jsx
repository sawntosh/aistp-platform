export default function StudyTransition({ topicTitle, questionCount, onStart }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-16 text-center">
      <span className="text-4xl" aria-hidden="true">
        📖
      </span>
      <h2 className="mt-4 text-xl font-semibold text-gray-900">Nice work.</h2>
      <p className="mt-2 max-w-sm text-sm text-gray-600">
        Let&apos;s reinforce what you just learned about <span className="font-medium text-gray-900">{topicTitle}</span>.
      </p>
      <p className="mt-1 max-w-sm text-sm text-gray-500">
        You&apos;ll answer {questionCount} question{questionCount === 1 ? "" : "s"} based specifically on this topic.
      </p>
      <p className="mt-3 text-xs font-medium uppercase tracking-wide text-indigo-500">No score. No exam pressure.</p>
      <button
        type="button"
        onClick={onStart}
        className="mt-6 rounded-md bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-indigo-500 active:scale-[0.98]"
      >
        Start Questions →
      </button>
    </div>
  );
}
