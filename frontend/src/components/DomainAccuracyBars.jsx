const WEAK_THRESHOLD = 60;

export default function DomainAccuracyBars({ domains }) {
  if (!domains?.length) {
    return (
      <div className="py-8 text-center text-sm text-gray-400">
        No domain data yet — complete a practice session to see this breakdown.
      </div>
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
                <p className="text-sm font-medium text-gray-900">{d.domain}</p>
                {isWeak && (
                  <p className="text-[11px] font-semibold tracking-wide text-red-600">NEEDS PRACTICE</p>
                )}
              </div>
              <div className="shrink-0 text-right">
                <p className="text-sm font-semibold tabular-nums text-gray-900">{d.accuracy_percent}%</p>
                <p className="text-xs tabular-nums text-gray-400">
                  {d.correct_count} / {d.total_count}
                </p>
              </div>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-100">
              <div
                className={`h-full rounded-full ${isWeak ? "bg-red-500" : "bg-indigo-600"}`}
                style={{ width: `${Math.min(100, d.accuracy_percent)}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
