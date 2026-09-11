import { cn } from "../lib/cn";
import Progress from "./ui/Progress";
import FocusAreaThresholdTag from "./FocusAreaThresholdTag";

const PRACTICE_THRESHOLD = 65;

export default function FocusAreaDomainRow({ domainName, accuracy, onAddToSession }) {
  const isOnTrack = accuracy >= PRACTICE_THRESHOLD;

  return (
    <div className="border-b border-border py-4 last:border-0">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="truncate text-body-sm font-medium text-text-primary">{domainName}</span>
        <span
          className={cn(
            "shrink-0 text-body-sm font-semibold tabular-nums",
            isOnTrack ? "text-text-secondary" : "text-error"
          )}
        >
          {accuracy}%
        </span>
      </div>

      <Progress value={accuracy} tone={isOnTrack ? "default" : "error"} className="mb-2" />

      <FocusAreaThresholdTag accuracy={accuracy} />

      {!isOnTrack && onAddToSession && (
        <button
          type="button"
          onClick={onAddToSession}
          className="mt-2 block cursor-pointer text-caption font-medium text-test hover:underline"
        >
          Add to session
        </button>
      )}
    </div>
  );
}
