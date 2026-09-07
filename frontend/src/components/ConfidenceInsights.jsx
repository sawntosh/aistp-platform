import { AlertTriangle, Lightbulb } from "lucide-react";
import EmptyState from "./ui/EmptyState";
import Progress from "./ui/Progress";

// Test Mode confidence diagnostics from GET /analytics/dashboard/'s
// `confidence` block. Additive signal only -- it never restates or
// changes the accuracy numbers shown elsewhere on the dashboard.
export default function ConfidenceInsights({ confidence }) {
  if (!confidence || !confidence.rated_count) {
    return (
      <EmptyState
        title="No confidence data yet"
        description="Finish a Test Mode session — you'll rate how sure you are on each answer — to see this."
      />
    );
  }

  const { average_confidence, by_level, high_confidence_mistakes, low_confidence_correct } = confidence;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Stat label="Average confidence" value={average_confidence != null ? `${average_confidence} / 5` : "—"} />
        <Stat
          label="High-confidence mistakes"
          value={high_confidence_mistakes}
          hint="Rated 4–5 but wrong"
          icon={AlertTriangle}
          tone="warning"
        />
        <Stat
          label="Low-confidence correct"
          value={low_confidence_correct}
          hint="Rated 1–2 but right"
          icon={Lightbulb}
          tone="primary"
        />
      </div>

      <div>
        <p className="mb-3 text-label text-text-secondary">Accuracy by confidence level</p>
        <div className="space-y-4">
          {by_level.map((row) => (
            <div key={row.level}>
              <div className="mb-1.5 flex items-baseline justify-between gap-4">
                <p className="text-body-sm font-medium text-text-primary">
                  {row.level} — {row.label}
                </p>
                <p className="shrink-0 text-body-sm tabular-nums text-text-muted">
                  {row.total === 0 ? (
                    "No answers"
                  ) : (
                    <>
                      <span className="font-semibold text-text-primary">{row.accuracy_percent}%</span>{" "}
                      ({row.correct}/{row.total})
                    </>
                  )}
                </p>
              </div>
              <Progress value={row.accuracy_percent ?? 0} tone={row.level >= 4 ? "default" : "test"} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, hint, icon: Icon, tone }) {
  const toneClass =
    tone === "warning" ? "text-warning" : tone === "primary" ? "text-primary" : "text-text-primary";
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <p className="flex items-center gap-1.5 text-caption font-medium uppercase tracking-wide text-text-muted">
        {Icon && <Icon className={`h-3.5 w-3.5 ${toneClass}`} aria-hidden="true" />}
        {label}
      </p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-text-primary">{value}</p>
      {hint && <p className="mt-0.5 text-caption text-text-muted">{hint}</p>}
    </div>
  );
}
