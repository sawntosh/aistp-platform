import Link from "next/link";

export default function StudyCompletion({ domainName, topicTitle, domainId, questionsAnswered, nextTopic }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-16 text-center">
      <h2 className="text-2xl font-semibold text-gray-900">Study session complete 🎉</h2>

      <div className="mt-4 max-w-sm rounded-xl border border-gray-200 bg-white p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">You&apos;ve finished</p>
        <p className="mt-1 text-sm text-gray-500">{domainName}</p>
        <p className="text-base font-semibold text-gray-900">{topicTitle}</p>
      </div>

      <p className="mt-4 max-w-sm text-sm text-gray-600">
        You&apos;ve reviewed the key concepts and reinforced your understanding with practice questions.
      </p>
      {questionsAnswered > 0 && (
        <p className="mt-1 text-xs text-gray-400">
          You completed {questionsAnswered} learning question{questionsAnswered === 1 ? "" : "s"}.
        </p>
      )}

      {nextTopic && (
        <div className="mt-6 w-full max-w-sm rounded-xl border border-indigo-100 bg-indigo-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-indigo-500">Next recommended topic</p>
          <p className="mt-1 text-sm font-semibold text-indigo-900">{nextTopic.title}</p>
          <Link
            href={`/study/${nextTopic.domain_id}/${nextTopic.id}`}
            className="mt-3 inline-block w-full rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-indigo-500 active:scale-[0.98]"
          >
            Continue Studying →
          </Link>
        </div>
      )}

      <Link href="/study" className="mt-4 text-sm font-medium text-gray-500 hover:text-gray-900">
        ← Back to Study Home
      </Link>
    </div>
  );
}
