import { Check, AlertTriangle } from "lucide-react";
import Badge from "./ui/Badge";

const PRACTICE_THRESHOLD = 60;

export default function FocusAreaThresholdTag({ accuracy }) {
  const isOnTrack = accuracy >= PRACTICE_THRESHOLD;

  return (
    <Badge tone={isOnTrack ? "success" : "error"}>
      {isOnTrack ? (
        <>
          <Check className="h-3 w-3" aria-hidden="true" />
          On track
        </>
      ) : (
        <>
          <AlertTriangle className="h-3 w-3" aria-hidden="true" />
          Below {PRACTICE_THRESHOLD}% practice threshold
        </>
      )}
    </Badge>
  );
}
