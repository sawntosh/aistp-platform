import { cn } from "../../lib/cn";

const TONES = {
  default: "bg-surface-muted text-text-secondary",
  primary: "bg-primary-muted text-primary",
  study: "bg-study-muted text-study",
  test: "bg-test-muted text-test",
  success: "bg-success-muted text-success",
  warning: "bg-warning-muted text-warning",
  error: "bg-error-muted text-error",
  info: "bg-info-muted text-info",
};

export default function Badge({ tone = "default", className = "", children, ...props }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-sm px-2 py-0.5 text-caption font-medium",
        TONES[tone] ?? TONES.default,
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
