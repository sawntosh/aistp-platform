import { useMemo, useState } from "react";
import { ChevronUp } from "lucide-react";
import EmptyState from "./ui/EmptyState";
import { cn } from "../lib/cn";

function formatDateTime(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

const COLUMNS = [
  { key: "started_at", label: "Date" },
  { key: "question_count", label: "Questions" },
  { key: "score", label: "Score" },
  { key: "accuracy_percent", label: "Accuracy" },
  { key: "finished_at", label: "Status" },
];

export default function AttemptHistoryTable({ sessions }) {
  const [sortKey, setSortKey] = useState("started_at");
  const [sortDir, setSortDir] = useState("desc");

  const sorted = useMemo(() => {
    if (!sessions?.length) return [];
    return [...sessions].sort((a, b) => {
      let aVal = a[sortKey];
      let bVal = b[sortKey];
      if (sortKey === "started_at" || sortKey === "finished_at") {
        aVal = aVal ? new Date(aVal).getTime() : 0;
        bVal = bVal ? new Date(bVal).getTime() : 0;
      } else {
        aVal = aVal ?? 0;
        bVal = bVal ?? 0;
      }
      const diff = aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
      return sortDir === "asc" ? diff : -diff;
    });
  }, [sessions, sortKey, sortDir]);

  function handleSort(key) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  if (!sessions?.length) {
    return (
      <div className="px-6 pb-6">
        <EmptyState title="No sessions yet" description="Start practicing to see your history here." />
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-border text-body-sm">
        <thead className="bg-surface-muted">
          <tr>
            {COLUMNS.map((col) => (
              <th key={col.key} scope="col" className="px-6 py-3 text-left text-caption font-medium uppercase tracking-wide text-text-muted">
                <button
                  type="button"
                  onClick={() => handleSort(col.key)}
                  className="flex cursor-pointer items-center gap-1 transition-colors hover:text-text-primary"
                >
                  {col.label}
                  {sortKey === col.key && (
                    <ChevronUp className={cn("h-3 w-3 transition-transform", sortDir === "desc" && "rotate-180")} aria-hidden="true" />
                  )}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {sorted.map((session) => {
            const isComplete = Boolean(session.finished_at);
            return (
              <tr key={session.id} className="transition-colors hover:bg-surface-muted">
                <td className="px-6 py-3 text-text-secondary">{formatDateTime(session.started_at)}</td>
                <td className="px-6 py-3 tabular-nums text-text-secondary">{session.question_count}</td>
                <td className="px-6 py-3 tabular-nums text-text-secondary">
                  {isComplete ? `${session.score} / ${session.question_count}` : "—"}
                </td>
                <td className="px-6 py-3 tabular-nums text-text-secondary">
                  {isComplete ? `${session.accuracy_percent}%` : "—"}
                </td>
                <td className="px-6 py-3">
                  <span className={cn("inline-flex items-center gap-1.5 font-medium", isComplete ? "text-success" : "text-primary")}>
                    <span className={cn("h-1.5 w-1.5 rounded-full", isComplete ? "bg-success" : "bg-primary")} />
                    {isComplete ? "Completed" : "In progress"}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
