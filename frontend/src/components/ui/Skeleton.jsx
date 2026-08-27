import { cn } from "../../lib/cn";

export default function Skeleton({ className = "" }) {
  return <div className={cn("animate-skeleton-pulse rounded-md bg-surface-muted", className)} />;
}
