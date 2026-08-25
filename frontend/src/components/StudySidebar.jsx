const STATUS_ICON = {
  completed: { icon: "✓", className: "text-emerald-600" },
  in_progress: { icon: "●", className: "text-indigo-600" },
  not_started: { icon: "○", className: "text-gray-300" },
};

function TopicRow({ topic, isCurrent, onSelect }) {
  const status = STATUS_ICON[topic.status] ?? STATUS_ICON.not_started;
  return (
    <button
      type="button"
      onClick={() => onSelect(topic.id)}
      aria-current={isCurrent ? "true" : undefined}
      disabled={!topic.has_content}
      className={`flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        isCurrent ? "bg-indigo-50 font-semibold text-indigo-900" : "text-gray-600 hover:bg-gray-50"
      }`}
    >
      <span aria-hidden="true" className={`w-4 shrink-0 text-center ${status.className}`}>
        {status.icon}
      </span>
      <span className="truncate">{topic.title}</span>
    </button>
  );
}

// Desktop: a fixed sidebar list. Mobile: collapses into a <details>
// dropdown so the topic list doesn't eat the whole viewport.
export default function StudySidebar({ topics, currentTopicId, onSelectTopic }) {
  return (
    <>
      <nav aria-label="Study content" className="hidden w-56 shrink-0 md:block">
        <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wide text-gray-400">Study content</p>
        <div className="space-y-0.5">
          {topics.map((topic) => (
            <TopicRow key={topic.id} topic={topic} isCurrent={topic.id === currentTopicId} onSelect={onSelectTopic} />
          ))}
        </div>
      </nav>

      <details className="mb-4 rounded-lg border border-gray-200 bg-white md:hidden">
        <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-gray-700">
          <span className="inline-flex items-center gap-2">
            📖 Study content <span aria-hidden="true">▾</span>
          </span>
        </summary>
        <div className="space-y-0.5 border-t border-gray-100 px-2 py-2">
          {topics.map((topic) => (
            <TopicRow key={topic.id} topic={topic} isCurrent={topic.id === currentTopicId} onSelect={onSelectTopic} />
          ))}
        </div>
      </details>
    </>
  );
}
