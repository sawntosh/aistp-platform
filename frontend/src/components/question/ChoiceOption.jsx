import { Check, X } from "lucide-react";
import { cn } from "../../lib/cn";

// One selectable answer row, styled as a quiet list row (radio / checkbox
// + "a." label + text) rather than a boxed button. `state` drives the
// post-submit reveal and is null while choosing:
//   "correct" -> this option is (part of) the right answer
//   "wrong"   -> the learner picked this and it is not correct
// `accent` keeps the two contexts distinct (indigo for the exam/practice
// runner, green for Study Mode) without changing the palette.
const ACCENT = {
  test: { selBg: "bg-test-muted/60", ctrlOn: "border-test bg-test", ring: "focus-visible:outline-test" },
  study: { selBg: "bg-study-muted/60", ctrlOn: "border-study bg-study", ring: "focus-visible:outline-study" },
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
  const isCorrect = state === "correct";
  const isWrong = state === "wrong";
  const interactive = !disabled;

  return (
    <button
      type="button"
      role={control === "checkbox" ? "checkbox" : "radio"}
      aria-checked={selected}
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        "-mx-2.5 flex w-full items-start gap-2.5 rounded-md px-2.5 py-2 text-left transition-colors",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
        a.ring,
        isCorrect
          ? "bg-success-muted/60"
          : isWrong
            ? "bg-error-muted/60"
            : selected
              ? a.selBg
              : interactive && "hover:bg-surface-muted",
        !interactive && "cursor-default"
      )}
    >
      <span
        className={cn(
          "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center border transition-colors",
          control === "checkbox" ? "rounded-[4px]" : "rounded-full",
          isCorrect
            ? "border-success bg-success text-white"
            : isWrong
              ? "border-error bg-error text-white"
              : selected
                ? cn(a.ctrlOn, "text-white")
                : "border-border-strong bg-surface text-transparent"
        )}
      >
        {isCorrect ? (
          <Check className="h-2.5 w-2.5" aria-hidden="true" />
        ) : isWrong ? (
          <X className="h-2.5 w-2.5" aria-hidden="true" />
        ) : control === "checkbox" ? (
          <Check className={cn("h-2.5 w-2.5", selected ? "opacity-100" : "opacity-0")} aria-hidden="true" />
        ) : (
          <span className={cn("h-1.5 w-1.5 rounded-full bg-white", selected ? "opacity-100" : "opacity-0")} />
        )}
      </span>

      {letter && (
        <span
          className={cn(
            "shrink-0 text-body-sm font-medium tabular-nums",
            isCorrect ? "text-success" : isWrong ? "text-error" : "text-text-muted"
          )}
        >
          {letter}.
        </span>
      )}

      <span
        className={cn(
          "flex-1 text-body-sm",
          isCorrect
            ? "text-success"
            : isWrong
              ? "text-error"
              : selected
                ? "font-medium text-text-primary"
                : "text-text-secondary"
        )}
      >
        {children}
      </span>

      {isCorrect && <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden="true" />}
      {isWrong && <X className="mt-0.5 h-4 w-4 shrink-0 text-error" aria-hidden="true" />}
    </button>
  );
}
