import { Flag } from "lucide-react";
import { cn } from "../../lib/cn";

// Jump-to-any-question grid. Pure presentation over the runner's existing
// per-question state -- no new source of truth. `results` (a
// { [id]: { isCorrect } } map) is only passed in Practice Mode, where
// correctness is known mid-session; exam modes pass nothing and answered
// cells read simply as "answered".
function cellClasses({ current, answered, correct, incorrect }) {
  if (current) return "border-test bg-test text-white";
  if (correct) return "border-success/60 bg-success-muted text-success";
  if (incorrect) return "border-error/60 bg-error-muted text-error";
  if (answered) return "border-test/50 bg-test-muted text-test";
  return "border-border bg-surface text-text-muted hover:border-test/40 hover:text-text-secondary";
}

export default function QuestionNavigator({
  questions,
  // The questions currently on screen: [activeStart, activeStart + activeCount).
  activeStart = 0,
  activeCount = 1,
  submittedIds,
  flaggedIds,
  results = null,
  onSelect,
  className = "",
}) {
  const showOutcome = Boolean(results);

  return (
    <div className={cn("rounded-xl border border-border bg-surface p-4", className)}>
      <p className="mb-3 text-caption font-semibold uppercase tracking-wide text-text-muted">
        Questions
      </p>

      <div className="grid grid-cols-8 gap-1.5 sm:grid-cols-10 xl:grid-cols-5">
        {questions.map((q, index) => {
          const current = index >= activeStart && index < activeStart + activeCount;
          const answered = submittedIds.has(q.id);
          const flagged = flaggedIds?.has(q.id);
          const outcome = showOutcome ? results[q.id] : null;
          const correct = Boolean(outcome?.isCorrect) && answered;
          const incorrect = showOutcome && answered && outcome && !outcome.isCorrect;

          return (
            <button
              key={q.id}
              type="button"
              onClick={() => onSelect(index)}
              aria-current={current ? "true" : undefined}
              aria-label={`Question ${index + 1}${answered ? ", answered" : ", not answered"}${
                flagged ? ", flagged" : ""
              }`}
              className={cn(
                "relative flex h-9 items-center justify-center rounded-md border text-caption font-semibold tabular-nums transition-colors",
                cellClasses({ current, answered, correct, incorrect }),
                current && activeCount === 1 && "ring-2 ring-test/40 ring-offset-1 ring-offset-surface"
              )}
            >
              {index + 1}
              {flagged && (
                <Flag
                  className="absolute -right-1 -top-1 h-3 w-3 fill-warning text-warning drop-shadow-[0_0_1px_rgb(var(--color-surface))]"
                  aria-hidden="true"
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
