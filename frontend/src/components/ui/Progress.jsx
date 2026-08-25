import { cn } from "../../lib/cn";

const FILL_TONES = {
  default: "bg-primary",
  study: "bg-study",
  test: "bg-test",
  success: "bg-success",
  warning: "bg-warning",
  error: "bg-error",
};

export default function Progress({ value = 0, max = 100, tone = "default", className = "", trackClassName = "" }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn("h-1.5 w-full overflow-hidden rounded-full bg-surface-muted", trackClassName)}
    >
      <div
        className={cn("h-full rounded-full transition-[width] duration-300 ease-out", FILL_TONES[tone] ?? FILL_TONES.default, className)}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
