import { cn } from "../../lib/cn";

export default function EmptyState({ icon: Icon, title, description, action, className = "" }) {
  return (
    <div className={cn("flex flex-col items-center rounded-lg border border-dashed border-border px-6 py-14 text-center", className)}>
      {Icon && (
        <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-surface-muted text-text-muted">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>
      )}
      <p className="text-body font-medium text-text-primary">{title}</p>
      {description && <p className="mt-1.5 max-w-sm text-body-sm text-text-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
