import { cn } from "../../lib/cn";

export default function Input({ className = "", invalid = false, ...props }) {
  return (
    <input
      className={cn(
        "h-10 w-full rounded-md border bg-surface px-3 text-body text-text-primary placeholder:text-text-muted",
        "transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
        invalid
          ? "border-error focus-visible:outline-error"
          : "border-border-strong focus-visible:outline-primary",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  );
}

export function Label({ className = "", ...props }) {
  return <label className={cn("mb-1.5 block text-label text-text-secondary", className)} {...props} />;
}
