import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import { cn } from "../../lib/cn";

const CONFIG = {
  info: { icon: Info, classes: "border-info/25 bg-info-muted text-info" },
  success: { icon: CheckCircle2, classes: "border-success/25 bg-success-muted text-success" },
  warning: { icon: AlertTriangle, classes: "border-warning/25 bg-warning-muted text-warning" },
  error: { icon: XCircle, classes: "border-error/25 bg-error-muted text-error" },
};

export default function Alert({ tone = "info", title, children, className = "" }) {
  const { icon: Icon, classes } = CONFIG[tone] ?? CONFIG.info;
  return (
    <div role="alert" className={cn("flex gap-3 rounded-md border px-4 py-3 text-body-sm", classes, className)}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <div className="text-text-secondary">
        {title && <p className="font-medium text-text-primary">{title}</p>}
        {children && <div className={title ? "mt-0.5" : ""}>{children}</div>}
      </div>
    </div>
  );
}
