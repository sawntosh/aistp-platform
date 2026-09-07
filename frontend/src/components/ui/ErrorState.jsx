import { AlertTriangle } from "lucide-react";
import Button from "./Button";
import EmptyState from "./EmptyState";

export default function ErrorState({
  title = "Couldn't load this",
  description = "Something went wrong. Try again.",
  onRetry,
  className = "",
}) {
  return (
    <EmptyState
      icon={AlertTriangle}
      title={title}
      description={description}
      action={
        onRetry && (
          <Button variant="outline" onClick={onRetry}>
            Try again
          </Button>
        )
      }
      className={className}
    />
  );
}
