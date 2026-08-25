import { useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "../../lib/cn";

export default function Dialog({ open, onClose, title, children, className = "" }) {
  useEffect(() => {
    if (!open) return undefined;
    function handleEscape(e) {
      if (e.key === "Escape") onClose?.();
    }
    document.addEventListener("keydown", handleEscape);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === "string" ? title : undefined}
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "w-full max-w-sm rounded-lg border border-border bg-surface p-6 shadow-lg animate-pop",
          className
        )}
      >
        {title && (
          <div className="mb-1 flex items-start justify-between gap-4">
            <h2 className="text-h3 text-text-primary">{title}</h2>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="rounded-sm p-1 text-text-muted transition-colors hover:bg-surface-muted hover:text-text-primary"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
