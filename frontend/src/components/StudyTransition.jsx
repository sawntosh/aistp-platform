import { Sparkles } from "lucide-react";
import Button from "./ui/Button";

export default function StudyTransition({ topicTitle, questionCount, onStart }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-16 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-study-muted text-study" aria-hidden="true">
        <Sparkles className="h-6 w-6" />
      </span>
      <h2 className="mt-4 text-h2 text-text-primary">Ready to reinforce what you learned?</h2>
      <p className="mt-2 max-w-sm text-body text-text-muted">
        You&apos;ll answer {questionCount} question{questionCount === 1 ? "" : "s"} based on{" "}
        <span className="font-medium text-text-primary">{topicTitle}</span>.
      </p>
      <p className="mt-3 text-label uppercase tracking-wide text-study">No score. Just practice.</p>
      <Button tone="study" size="lg" onClick={onStart} className="mt-7">
        Start Knowledge Check
      </Button>
    </div>
  );
}
