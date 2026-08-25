import { RichText } from "../utils/richText";

export default function StudyContentReader({ domainName, topicTitle, topicPosition, topicCount, content, onContinue, hasQuestions }) {
  return (
    <article className="min-w-0 flex-1">
      <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">{domainName}</p>
      {topicPosition != null && topicCount != null && (
        <p className="mt-0.5 text-xs text-gray-400">
          Topic {topicPosition} of {topicCount}
        </p>
      )}
      <h2 className="mt-2 text-2xl font-semibold text-gray-900 sm:text-3xl">{topicTitle}</h2>

      <div className="mt-6 max-w-2xl">
        {content ? (
          <RichText text={content.content} />
        ) : (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            The reading for this topic hasn&apos;t been published yet.
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={onContinue}
        className="mt-8 rounded-md bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-indigo-500 active:scale-[0.98]"
      >
        {hasQuestions ? "Continue to Questions →" : "Finish topic →"}
      </button>
    </article>
  );
}
