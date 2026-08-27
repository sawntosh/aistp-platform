import { cn } from "../../lib/cn";

export default function IconButton({ icon: Icon, label, className = "", variant = "ghost", ...props }) {
  const variantClasses =
    variant === "ghost"
      ? "text-text-muted hover:bg-surface-muted hover:text-text-primary"
      : "border border-border-strong text-text-secondary hover:bg-surface-muted hover:text-text-primary";

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-md transition-colors duration-150",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
        "disabled:cursor-not-allowed disabled:opacity-50",
        variantClasses,
        className
      )}
      {...props}
    >
      <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
    </button>
  );
}
