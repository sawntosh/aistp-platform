import Link from "next/link";
import { cn } from "../../lib/cn";

const TONE_SOLID = {
  default: "bg-primary text-primary-foreground hover:bg-primary-hover",
  study: "bg-study text-white hover:bg-study-hover",
  test: "bg-test text-white hover:bg-test-hover",
  destructive: "bg-error text-white hover:opacity-90",
};

const TONE_OUTLINE = {
  default: "border border-border-strong text-text-secondary hover:bg-surface-muted hover:text-text-primary",
  study: "border border-study/30 text-study hover:bg-study-muted",
  test: "border border-test/30 text-test hover:bg-test-muted",
  destructive: "border border-error/30 text-error hover:bg-error-muted",
};

const VARIANTS = {
  primary: (tone) => TONE_SOLID[tone] ?? TONE_SOLID.default,
  outline: (tone) => TONE_OUTLINE[tone] ?? TONE_OUTLINE.default,
  secondary: () => "bg-surface-muted text-text-primary hover:bg-border",
  ghost: () => "text-text-secondary hover:bg-surface-muted hover:text-text-primary",
  link: (tone) =>
    `px-0 py-0 h-auto font-medium underline-offset-4 hover:underline ${
      tone === "study" ? "text-study" : tone === "test" ? "text-test" : "text-primary"
    }`,
};

const SIZES = {
  sm: "h-8 px-3 text-body-sm gap-1.5 rounded-sm",
  md: "h-10 px-4 text-body gap-2 rounded-md",
  lg: "h-11 px-5 text-body-lg gap-2 rounded-md",
  icon: "h-9 w-9 rounded-sm",
};

export function buttonClasses({ variant = "primary", tone = "default", size = "md", className = "" } = {}) {
  return cn(
    "inline-flex shrink-0 cursor-pointer select-none items-center justify-center whitespace-nowrap font-medium transition-colors duration-150",
    "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
    "disabled:cursor-not-allowed disabled:opacity-50",
    VARIANTS[variant]?.(tone),
    variant !== "link" && SIZES[size],
    className
  );
}

export default function Button({
  variant = "primary",
  tone = "default",
  size = "md",
  href,
  className = "",
  children,
  isLoading = false,
  disabled = false,
  ...props
}) {
  const classes = buttonClasses({ variant, tone, size, className });

  if (href) {
    return (
      <Link href={href} className={classes} {...props}>
        {children}
      </Link>
    );
  }

  return (
    <button type="button" className={classes} disabled={disabled || isLoading} {...props}>
      {isLoading && (
        <span
          aria-hidden="true"
          className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      )}
      {children}
    </button>
  );
}
