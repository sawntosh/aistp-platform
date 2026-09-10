import { CheckCircle2, XCircle } from "lucide-react";
import { cn } from "../../lib/cn";

// The post-submit verdict callout: a calm green "Correct answer" panel or
// a "Not quite" panel with the accepted answer spelled out.
// Presentational only -- the AI explanation and domain resources are
// rendered by the caller (side panel on the live runner, inline on the
// end-of-exam review). `wrongTone` lets Study Mode use amber ("a lesson,
// not a graded miss") while the exam uses red.
const WRONG = {
  error: {
    box: "border-error/30 bg-error-muted",
    text: "text-error",
  },
  warning: {
    box: "border-warning/30 bg-warning-muted",
    text: "text-warning",
  },
};

export default function AnswerReveal({
  isCorrect,
  correctAnswerText,
  wrongTone = "error",
  relatedLabel,
  children,
}) {
  const bad = WRONG[wrongTone] ?? WRONG.error;

  return (
    <div
      role="status"
      className={cn(
        "mt-4 rounded-lg border p-5 animate-pop",
        isCorrect ? "border-success/30 bg-success-muted" : bad.box
      )}
    >
      <p
        className={cn(
          "flex items-center gap-2 text-body-sm font-semibold",
          isCorrect ? "text-success" : bad.text
        )}
      >
        {isCorrect ? (
          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
        ) : (
          <XCircle className="h-4 w-4" aria-hidden="true" />
        )}
        {isCorrect ? "Correct answer" : "Not quite"}
      </p>

      {!isCorrect && correctAnswerText && (
        <p className="mt-1.5 text-body-sm text-text-secondary">
          Correct answer:{" "}
          <span className="font-medium text-text-primary">{correctAnswerText}</span>
        </p>
      )}

      {children && <div className="mt-3">{children}</div>}

      {relatedLabel && (
        <p className="mt-3 text-caption text-text-muted">
          Related topic:{" "}
          <span className="font-medium text-text-secondary">{relatedLabel}</span>
        </p>
      )}
    </div>
  );
}
