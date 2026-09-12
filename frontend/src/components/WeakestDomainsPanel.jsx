import { Check, TrendingDown } from "lucide-react";
import { cn } from "../lib/cn";
import { Card, CardHeader, CardTitle, CardContent } from "./ui/Card";
import Badge from "./ui/Badge";
import Progress from "./ui/Progress";

const WEAK_THRESHOLD = 60;

export default function WeakestDomainsPanel({ status, domains, selectedDomainIds, onToggleDomain }) {
  return (
    <Card>
      <CardHeader className="flex-row items-center gap-2 space-y-0 pb-0">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-test-muted text-test">
          <TrendingDown className="h-4 w-4" aria-hidden="true" />
        </span>
        <CardTitle className="text-body font-semibold">Focus areas</CardTitle>
      </CardHeader>
      <CardContent>
        {status === "loading" && <p className="text-body-sm text-text-muted">Checking your accuracy by domain…</p>}

        {status === "guest" && (
          <p className="text-body-sm text-text-muted">Log in to get personalized domain suggestions based on your accuracy.</p>
        )}

        {status === "empty" && (
          <p className="text-body-sm text-text-muted">Complete a session to get personalized suggestions for where to focus next.</p>
        )}

        {status === "ready" && domains.length === 0 && (
          <p className="text-body-sm text-text-muted">You&apos;re accurate across every domain so far — pick any to keep sharp.</p>
        )}

        {status === "ready" && domains.length > 0 && (
          <>
            <p className="mb-4 text-body-sm text-text-muted">Your weakest domains, based on past sessions.</p>
            <div className="space-y-4">
              {domains.map((d) => {
                const isWeak = d.accuracy_percent < WEAK_THRESHOLD;
                const isSelected = d.id != null && selectedDomainIds.includes(d.id);
                return (
                  <div key={d.domain}>
                    <div className="mb-1 flex items-baseline justify-between gap-2">
                      <p className="truncate text-body-sm font-medium text-text-primary">{d.domain}</p>
                      <span className={cn("shrink-0 text-body-sm font-semibold tabular-nums", isWeak ? "text-error" : "text-text-secondary")}>
                        {d.accuracy_percent}%
                      </span>
                    </div>
                    <Progress value={d.accuracy_percent} tone={isWeak ? "error" : "default"} className="mb-2" />
                    {d.id != null && (
                      <button
                        type="button"
                        onClick={() => onToggleDomain(d.id)}
                        className={cn(
                          "flex cursor-pointer items-center gap-1 text-caption font-medium transition-colors",
                          isSelected ? "text-success" : "text-test hover:underline"
                        )}
                      >
                        {isSelected ? (
                          <>
                            <Check className="h-3 w-3" aria-hidden="true" />
                            Added to session
                          </>
                        ) : (
                          "Add to session"
                        )}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            {domains.some((d) => d.accuracy_percent < WEAK_THRESHOLD) && (
              <Badge tone="error" className="mt-4">
                Below {WEAK_THRESHOLD}% practice threshold
              </Badge>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
