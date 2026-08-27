import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { cn } from "../../lib/cn";

export default function PageHeader({ eyebrow, title, description, backHref, backLabel = "Back", actions, className = "" }) {
  return (
    <div className={cn("mb-8", className)}>
      {backHref && (
        <Link
          href={backHref}
          className="mb-3 inline-flex items-center gap-1 text-body-sm font-medium text-text-muted transition-colors hover:text-text-primary"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          {backLabel}
        </Link>
      )}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          {eyebrow && <p className="mb-1.5 text-label uppercase tracking-wide text-text-muted">{eyebrow}</p>}
          <h1 className="text-h1 text-text-primary">{title}</h1>
          {description && <p className="mt-1.5 max-w-2xl text-body text-text-muted">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-3">{actions}</div>}
      </div>
    </div>
  );
}

export function SectionHeader({ title, description, actions, className = "" }) {
  return (
    <div className={cn("mb-4 flex flex-wrap items-end justify-between gap-3", className)}>
      <div>
        <h2 className="text-h3 text-text-primary">{title}</h2>
        {description && <p className="mt-0.5 text-body-sm text-text-muted">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
