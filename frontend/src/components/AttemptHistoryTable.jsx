import { useMemo, useState } from "react";

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

function SortIcon({ direction }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="currentColor"
      className={`h-3 w-3 transition-transform ${direction === "asc" ? "rotate-180" : ""}`}
    >
      <path
        fillRule="evenodd"
        d="M10 12.5a.75.75 0 0 1-.53-.22l-4-4a.75.75 0 1 1 1.06-1.06L10 10.69l3.47-3.47a.75.75 0 1 1 1.06 1.06l-4 4a.75.75 0 0 1-.53.22Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

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
      <div className="px-6 pb-6 text-sm text-gray-400">
        No sessions yet — start practicing to see your history here.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-100 text-sm">
        <thead className="bg-indigo-50/60">
          <tr>
            {COLUMNS.map((col) => (
              <th
                key={col.key}
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500"
              >
                <button
                  type="button"
                  onClick={() => handleSort(col.key)}
                  className="flex items-center gap-1 transition-colors hover:text-gray-900"
                >
                  {col.label}
                  {sortKey === col.key && <SortIcon direction={sortDir} />}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {sorted.map((session) => {
            const isComplete = Boolean(session.finished_at);
            return (
              <tr key={session.id} className="transition-colors hover:bg-gray-50">
                <td className="px-6 py-3 text-gray-700">{formatDateTime(session.started_at)}</td>
                <td className="px-6 py-3 tabular-nums text-gray-700">{session.question_count}</td>
                <td className="px-6 py-3 tabular-nums text-gray-700">
                  {isComplete ? `${session.score} / ${session.question_count}` : "—"}
                </td>
                <td className="px-6 py-3 tabular-nums text-gray-700">
                  {isComplete ? `${session.accuracy_percent}%` : "—"}
                </td>
                <td className="px-6 py-3">
                  <span
                    className={`inline-flex items-center gap-1.5 text-sm font-medium ${
                      isComplete ? "text-emerald-600" : "text-indigo-600"
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        isComplete ? "bg-emerald-500" : "bg-indigo-500"
                      }`}
                    />
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
