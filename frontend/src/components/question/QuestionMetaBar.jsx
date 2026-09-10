import { Flag } from "lucide-react";
import { cn } from "../../lib/cn";
import { getDomainColor } from "../../utils/domainColors";

// The pill row above a question: type, difficulty, domain, plus an
// optional flag/bookmark toggle (client-side only). Which pills show is
// decided by the caller so exam modes can stay spartan.
const TYPE_LABEL = {
  mcq: "Multiple choice",
  true_false: "True / False",
  multi_select: "Multiple answer",
  fill_blank: "Short answer",
  matching: "Matching",
};

const DIFFICULTY_TONE = {
  easy: "bg-success-muted text-success",
  medium: "bg-warning-muted text-warning",
  hard: "bg-error-muted text-error",
};

function Pill({ className = "", children }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-caption font-medium",
        className
      )}
    >
      {children}
    </span>
  );
}

export default function QuestionMetaBar({
  question,
  showType = true,
  showDifficulty = true,
  showDomain = true,
  flagged = false,
  onToggleFlag,
}) {
  const domainColor = getDomainColor(question.domain?.name);

  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="flex flex-wrap items-center gap-1.5">
        {showType && (
          <Pill className="bg-test-muted text-test">
            {TYPE_LABEL[question.question_type] ?? question.question_type}
          </Pill>
        )}
        {showDifficulty && question.difficulty && (
          <Pill className={cn("capitalize", DIFFICULTY_TONE[question.difficulty] ?? "bg-surface-muted text-text-muted")}>
            {question.difficulty}
          </Pill>
        )}
        {showDomain && question.domain?.name && (
          <Pill className={cn(domainColor.bg, domainColor.text)}>{question.domain.name}</Pill>
        )}
      </div>

      {onToggleFlag && (
        <button
          type="button"
          onClick={onToggleFlag}
          aria-pressed={flagged}
          aria-label={flagged ? "Remove flag from this question" : "Flag this question to revisit"}
          title={flagged ? "Flagged — click to unflag" : "Flag this question"}
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-md border transition-colors",
            flagged
              ? "border-warning/40 bg-warning-muted text-warning"
              : "border-border text-text-muted hover:border-warning/40 hover:text-warning"
          )}
        >
          <Flag className={cn("h-4 w-4", flagged && "fill-current")} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
