import { AlertTriangle } from "lucide-react";
import Button from "./Button";
import EmptyState from "./EmptyState";

export default function ErrorState({
  title = "Something went wrong",
  description = "We couldn't load this. Please try again.",
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
