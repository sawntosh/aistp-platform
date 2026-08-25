import Link from "next/link";
import { ArrowRight, Brain, CheckCircle2, FolderKanban, Puzzle, RefreshCw, Search, Wrench } from "lucide-react";
import { cn } from "../lib/cn";

const DOMAIN_ICONS = [Puzzle, RefreshCw, Search, Brain, FolderKanban, Wrench];

export default function StudyDomainCard({ domain, index }) {
  const hasTopics = domain.topic_count > 0;
  const allCompleted = hasTopics && domain.completed_count === domain.topic_count;
  const hasProgress = domain.completed_count > 0 || domain.in_progress_count > 0;
  const Icon = DOMAIN_ICONS[index % DOMAIN_ICONS.length];

  return (
    <Link
      href={hasTopics ? `/study/${domain.id}` : "#"}
      aria-disabled={!hasTopics}
      className={cn(
        "flex flex-col rounded-lg border border-border bg-surface p-5 text-left transition-all duration-150",
        hasTopics ? "hover:border-study/40 hover:shadow-sm" : "cursor-not-allowed opacity-50"
      )}
      onClick={(event) => {
        if (!hasTopics) event.preventDefault();
      }}
    >
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-study-muted text-study" aria-hidden="true">
          <Icon className="h-5 w-5" />
        </span>
        <h3 className="text-body font-semibold text-text-primary">{domain.name}</h3>
      </div>
      {domain.description && <p className="mt-2 text-body-sm text-text-muted">{domain.description}</p>}

      <div className="mt-4 flex items-center justify-between text-body-sm">
        <span className="text-text-muted">
          {hasTopics ? `${domain.topic_count} topic${domain.topic_count === 1 ? "" : "s"}` : "No topics yet"}
        </span>
        {allCompleted ? (
          <span className="flex items-center gap-1 font-medium text-success">
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
            Completed
          </span>
        ) : hasProgress ? (
          <span className="font-medium text-study">
            {domain.completed_count}/{domain.topic_count} reviewed
          </span>
        ) : null}
      </div>

      {hasTopics && (
        <span className="mt-3 flex items-center gap-1 text-body-sm font-semibold text-study">
          {hasProgress ? "Continue learning" : "Start learning"}
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </span>
      )}
    </Link>
  );
}
