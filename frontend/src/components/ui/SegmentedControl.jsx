import { cn } from "../../lib/cn";

export default function SegmentedControl({ options, value, onChange, className = "" }) {
  return (
    <div role="tablist" className={cn("inline-flex rounded-md bg-surface-muted p-0.5", className)}>
      {options.map((option) => {
        const isSelected = option.value === value;
        const Icon = option.icon;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={isSelected}
            onClick={() => onChange(option.value)}
            className={cn(
              "flex cursor-pointer items-center gap-1.5 rounded px-3 py-1.5 text-body-sm font-medium transition-colors duration-150",
              isSelected ? "bg-surface text-primary shadow-xs" : "text-text-muted hover:text-text-primary"
            )}
          >
            {Icon && <Icon className="h-3.5 w-3.5" aria-hidden="true" />}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
