import Link from "next/link";

const DOMAIN_ICONS = ["🧩", "🔄", "🔍", "🧠", "🗂️", "🛠️"];

export default function StudyDomainCard({ domain, index }) {
  const hasTopics = domain.topic_count > 0;
  const allCompleted = hasTopics && domain.completed_count === domain.topic_count;
  const hasProgress = domain.completed_count > 0 || domain.in_progress_count > 0;

  return (
    <Link
      href={hasTopics ? `/study/${domain.id}` : "#"}
      aria-disabled={!hasTopics}
      className={`flex flex-col rounded-xl border-2 p-5 text-left transition-all ${
        hasTopics
          ? "border-gray-200 bg-white hover:border-indigo-300 hover:shadow-sm active:scale-[0.99]"
          : "cursor-not-allowed border-gray-100 bg-gray-50 opacity-60"
      }`}
      onClick={(event) => {
        if (!hasTopics) event.preventDefault();
      }}
    >
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-lg" aria-hidden="true">
          {DOMAIN_ICONS[index % DOMAIN_ICONS.length]}
        </span>
        <h3 className="text-sm font-semibold text-gray-900">{domain.name}</h3>
      </div>
      {domain.description && <p className="mt-2 text-xs text-gray-500">{domain.description}</p>}

      <div className="mt-4 flex items-center justify-between text-xs">
        <span className="text-gray-500">
          {hasTopics ? `${domain.topic_count} topic${domain.topic_count === 1 ? "" : "s"}` : "No topics yet"}
        </span>
        {allCompleted ? (
          <span className="font-medium text-emerald-600">Completed</span>
        ) : hasProgress ? (
          <span className="font-medium text-indigo-600">
            {domain.completed_count}/{domain.topic_count} reviewed
          </span>
        ) : null}
      </div>

      {hasTopics && (
        <span className="mt-3 text-xs font-semibold text-indigo-600">
          {hasProgress ? "Continue learning →" : "Start learning →"}
        </span>
      )}
    </Link>
  );
}
