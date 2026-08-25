import { BookOpen, Check, ChevronDown, Circle, CircleDot } from "lucide-react";
import { cn } from "../lib/cn";

const STATUS_ICON = {
  completed: { icon: Check, className: "text-success" },
  in_progress: { icon: CircleDot, className: "text-study" },
  not_started: { icon: Circle, className: "text-text-muted/50" },
};

function TopicRow({ topic, isCurrent, onSelect }) {
  const status = STATUS_ICON[topic.status] ?? STATUS_ICON.not_started;
  const StatusIcon = status.icon;
  return (
    <button
      type="button"
      onClick={() => onSelect(topic.id)}
      aria-current={isCurrent ? "true" : undefined}
      disabled={!topic.has_content}
      className={cn(
        "flex w-full cursor-pointer items-center gap-2.5 rounded-md px-3 py-2 text-left text-body-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40",
        isCurrent ? "bg-study-muted font-semibold text-study" : "text-text-secondary hover:bg-surface-muted"
      )}
    >
      <StatusIcon className={cn("h-3.5 w-3.5 shrink-0", status.className)} aria-hidden="true" />
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
        <p className="mb-2 px-3 text-label uppercase tracking-wide text-text-muted">Study content</p>
        <div className="space-y-0.5">
          {topics.map((topic) => (
            <TopicRow key={topic.id} topic={topic} isCurrent={topic.id === currentTopicId} onSelect={onSelectTopic} />
          ))}
        </div>
      </nav>

      <details className="mb-4 rounded-lg border border-border bg-surface md:hidden">
        <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-body-sm font-medium text-text-secondary [&::-webkit-details-marker]:hidden">
          <span className="inline-flex items-center gap-2">
            <BookOpen className="h-4 w-4" aria-hidden="true" />
            Study content
          </span>
          <ChevronDown className="h-4 w-4" aria-hidden="true" />
        </summary>
        <div className="space-y-0.5 border-t border-border px-2 py-2">
          {topics.map((topic) => (
            <TopicRow key={topic.id} topic={topic} isCurrent={topic.id === currentTopicId} onSelect={onSelectTopic} />
          ))}
        </div>
      </details>
    </>
  );
}
