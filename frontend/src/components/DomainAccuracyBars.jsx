import { AlertTriangle } from "lucide-react";
import EmptyState from "./ui/EmptyState";
import Progress from "./ui/Progress";

const WEAK_THRESHOLD = 60;

export default function DomainAccuracyBars({ domains }) {
  if (!domains?.length) {
    return (
      <EmptyState
        title="No domain data yet"
        description="Complete a practice session to see this breakdown."
      />
    );
  }

  const sorted = [...domains].sort((a, b) => a.accuracy_percent - b.accuracy_percent);

  return (
    <div className="space-y-5">
      {sorted.map((d) => {
        const isWeak = d.accuracy_percent < WEAK_THRESHOLD;
        return (
          <div key={d.domain}>
            <div className="mb-1.5 flex items-baseline justify-between gap-4">
              <div>
                <p className="text-body-sm font-medium text-text-primary">{d.domain}</p>
                {isWeak && (
                  <p className="mt-0.5 flex items-center gap-1 text-caption font-semibold tracking-wide text-error">
                    <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                    NEEDS PRACTICE
                  </p>
                )}
              </div>
              <div className="shrink-0 text-right">
                <p className="text-body-sm font-semibold tabular-nums text-text-primary">{d.accuracy_percent}%</p>
                <p className="text-caption tabular-nums text-text-muted">
                  {d.correct_count} / {d.total_count}
                </p>
              </div>
            </div>
            <Progress value={Math.min(100, d.accuracy_percent)} tone={isWeak ? "error" : "default"} />
          </div>
        );
      })}
    </div>
  );
}
