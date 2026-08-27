import { cn } from "../../lib/cn";

export function Card({ className = "", interactive = false, as: As = "div", ...props }) {
  return (
    <As
      className={cn(
        "rounded-lg border border-border bg-surface",
        interactive && "cursor-pointer transition-all duration-150 hover:border-border-strong hover:shadow-sm",
        className
      )}
      {...props}
    />
  );
}

export function CardHeader({ className = "", ...props }) {
  return <div className={cn("flex flex-col gap-1 p-5 pb-0", className)} {...props} />;
}

export function CardTitle({ className = "", ...props }) {
  return <h3 className={cn("text-h3 font-semibold text-text-primary", className)} {...props} />;
}

export function CardDescription({ className = "", ...props }) {
  return <p className={cn("text-body-sm text-text-muted", className)} {...props} />;
}

export function CardContent({ className = "", ...props }) {
  return <div className={cn("p-5", className)} {...props} />;
}

export function CardFooter({ className = "", ...props }) {
  return <div className={cn("flex items-center gap-3 p-5 pt-0", className)} {...props} />;
}
