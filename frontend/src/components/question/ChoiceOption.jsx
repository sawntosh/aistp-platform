import { Check, X } from "lucide-react";
import { cn } from "../../lib/cn";

// One selectable answer row (A / B / C / D) shared by every choice-based
// question type. `state` drives the post-submit reveal colouring and is
// null while the learner is still choosing:
//   "correct"  -> this option is (part of) the right answer
//   "wrong"    -> the learner picked this and it's not correct
// Radio vs checkbox is purely the control glyph -- selection behaviour is
// owned by the parent. `accent` keeps the two contexts distinct: indigo
// for the exam/practice runner, green for Study Mode.
const ACCENT = {
  test: {
    selBorder: "border-test",
    selBg: "bg-test-muted",
    hover: "hover:border-test/40 hover:bg-test-muted/30",
    ctrlOn: "border-test bg-test text-white",
    ctrlHover: "group-hover:border-test/60",
    badgeOn: "bg-test/15 text-test",
    textOn: "text-test",
    ring: "focus-visible:outline-test",
  },
  study: {
    selBorder: "border-study",
    selBg: "bg-study-muted",
    hover: "hover:border-study/40 hover:bg-study-muted/30",
    ctrlOn: "border-study bg-study text-white",
    ctrlHover: "group-hover:border-study/60",
    badgeOn: "bg-study/15 text-study",
    textOn: "text-study",
    ring: "focus-visible:outline-study",
  },
};

export default function ChoiceOption({
  letter,
  children,
  control = "radio",
  accent = "test",
  selected = false,
  disabled = false,
  state = null,
  onSelect,
}) {
  const a = ACCENT[accent] ?? ACCENT.test;
  const revealed = state !== null;
  const isCorrect = state === "correct";
  const isWrong = state === "wrong";

  return (
    <button
      type="button"
      role={control === "checkbox" ? "checkbox" : "radio"}
      aria-checked={selected}
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        "group flex w-full items-center gap-3 rounded-lg border px-4 py-3.5 text-left transition-colors duration-150",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
        a.ring,
        isCorrect
          ? "border-success bg-success-muted"
          : isWrong
            ? "border-error bg-error-muted"
            : selected
              ? cn(a.selBorder, a.selBg)
              : cn("border-border bg-surface", !disabled && a.hover),
        (revealed || disabled) && "cursor-default"
      )}
    >
      <span
        className={cn(
          "flex h-5 w-5 shrink-0 items-center justify-center border transition-colors",
          control === "checkbox" ? "rounded-[5px]" : "rounded-full",
          isCorrect
            ? "border-success bg-success text-white"
            : isWrong
              ? "border-error bg-error text-white"
              : selected
                ? a.ctrlOn
                : cn("border-border-strong bg-surface", a.ctrlHover)
        )}
      >
        {isCorrect ? (
          <Check className="h-3 w-3" aria-hidden="true" />
        ) : isWrong ? (
          <X className="h-3 w-3" aria-hidden="true" />
        ) : control === "checkbox" ? (
          <Check className={cn("h-3 w-3", selected ? "opacity-100" : "opacity-0")} aria-hidden="true" />
        ) : (
          <span className={cn("h-2 w-2 rounded-full bg-white", selected ? "opacity-100" : "opacity-0")} />
        )}
      </span>

      {letter && (
        <span
          className={cn(
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-caption font-semibold tabular-nums",
            isCorrect
              ? "bg-success/15 text-success"
              : isWrong
                ? "bg-error/15 text-error"
                : selected
                  ? a.badgeOn
                  : "bg-surface-muted text-text-muted"
          )}
        >
          {letter}
        </span>
      )}

      <span
        className={cn(
          "text-body-sm",
          isCorrect
            ? "text-success"
            : isWrong
              ? "text-error"
              : selected
                ? a.textOn
                : "text-text-secondary"
        )}
      >
        {children}
      </span>
    </button>
  );
}
