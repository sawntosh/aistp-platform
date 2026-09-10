import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "../../lib/cn";

// Page-number pagination for the question list. `page` / `pageCount` are
// 0-based / a count; `onChange(nextPageIndex)` is called with a clamped
// 0-based index. Long ranges collapse to first … window … last.
function pageWindow(page, pageCount) {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, i) => i);
  const out = new Set([0, pageCount - 1, page, page - 1, page + 1]);
  const sorted = [...out].filter((p) => p >= 0 && p < pageCount).sort((a, b) => a - b);
  const withGaps = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) withGaps.push("gap");
    withGaps.push(p);
  });
  return withGaps;
}

export default function Pagination({ page, pageCount, onChange, className = "" }) {
  if (pageCount <= 1) return null;
  const go = (p) => onChange(Math.max(0, Math.min(pageCount - 1, p)));

  return (
    <nav
      aria-label="Question pages"
      className={cn("flex flex-wrap items-center gap-1.5", className)}
    >
      <button
        type="button"
        onClick={() => go(page - 1)}
        disabled={page === 0}
        className="inline-flex h-9 items-center gap-1 rounded-md border border-border-strong px-2.5 text-body-sm font-medium text-text-secondary transition-colors hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-40"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        Prev
      </button>

      {pageWindow(page, pageCount).map((p, i) =>
        p === "gap" ? (
          <span key={`gap-${i}`} className="px-1 text-caption text-text-muted">
            …
          </span>
        ) : (
          <button
            key={p}
            type="button"
            onClick={() => go(p)}
            aria-current={p === page ? "page" : undefined}
            className={cn(
              "flex h-9 min-w-9 items-center justify-center rounded-md border px-2 text-body-sm font-semibold tabular-nums transition-colors",
              p === page
                ? "border-test bg-test text-white"
                : "border-border-strong text-text-secondary hover:bg-surface-muted"
            )}
          >
            {p + 1}
          </button>
        )
      )}

      <button
        type="button"
        onClick={() => go(page + 1)}
        disabled={page === pageCount - 1}
        className="inline-flex h-9 items-center gap-1 rounded-md border border-border-strong px-2.5 text-body-sm font-medium text-text-secondary transition-colors hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-40"
      >
        Next
        <ChevronRight className="h-4 w-4" aria-hidden="true" />
      </button>
    </nav>
  );
}
