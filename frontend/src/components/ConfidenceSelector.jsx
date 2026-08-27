import { useRef } from "react";
import { Check } from "lucide-react";
import { CONFIDENCE_LEVELS, confidenceLabel } from "../lib/confidence";
import { cn } from "../lib/cn";

// Test Mode: after an answer is chosen the learner rates how sure they
// are (1-5). No option is pre-selected; the parent blocks submission
// until `value` is set. Keyboard: Tab into the group, Arrow keys move
// between levels (roving tabindex), Space/Enter selects.
export default function ConfidenceSelector({ value = null, onChange, disabled = false, idPrefix = "confidence" }) {
  const buttonsRef = useRef([]);

  function focusLevel(index) {
    const clamped = Math.max(0, Math.min(CONFIDENCE_LEVELS.length - 1, index));
    buttonsRef.current[clamped]?.focus();
  }

  function handleKeyDown(event, index) {
    if (disabled) return;
    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
        event.preventDefault();
        focusLevel(index + 1);
        break;
      case "ArrowLeft":
      case "ArrowUp":
        event.preventDefault();
        focusLevel(index - 1);
        break;
      case "Home":
        event.preventDefault();
        focusLevel(0);
        break;
      case "End":
        event.preventDefault();
        focusLevel(CONFIDENCE_LEVELS.length - 1);
        break;
      default:
        break;
    }
  }

  // Which button holds tabindex=0 when nothing is selected yet: the first.
  const activeIndex = value ? CONFIDENCE_LEVELS.findIndex((l) => l.value === value) : 0;

  return (
    <div className="mt-5">
      <p id={`${idPrefix}-label`} className="text-body-sm font-medium text-text-primary">
        How confident are you?
      </p>

      <div
        role="radiogroup"
        aria-labelledby={`${idPrefix}-label`}
        aria-required="true"
        className="mt-2 flex gap-2"
      >
        {CONFIDENCE_LEVELS.map((level, index) => {
          const isSelected = value === level.value;
          return (
            <button
              key={level.value}
              ref={(el) => (buttonsRef.current[index] = el)}
              type="button"
              role="radio"
              aria-checked={isSelected}
              aria-label={`${level.value} — ${level.label}`}
              tabIndex={index === activeIndex ? 0 : -1}
              disabled={disabled}
              onClick={() => onChange?.(level.value)}
              onKeyDown={(e) => handleKeyDown(e, index)}
              className={cn(
                "flex h-11 flex-1 items-center justify-center gap-1 rounded-md border text-body-sm font-semibold tabular-nums transition-all duration-150",
                "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-test",
                isSelected
                  ? "border-test bg-test text-white shadow-xs"
                  : "border-border-strong bg-surface text-text-secondary hover:border-test/50 hover:bg-test-muted/40",
                disabled && "cursor-not-allowed opacity-50"
              )}
            >
              {isSelected && <Check className="h-3.5 w-3.5" aria-hidden="true" />}
              {level.value}
            </button>
          );
        })}
      </div>

      <div className="mt-1 flex justify-between text-caption text-text-muted">
        <span>1 — Guessing</span>
        <span>5 — Very confident</span>
      </div>

      <p aria-live="polite" className="mt-1 min-h-[1.25rem] text-caption font-medium text-test">
        {value ? `Selected: ${value} — ${confidenceLabel(value)}` : ""}
      </p>
    </div>
  );
}
