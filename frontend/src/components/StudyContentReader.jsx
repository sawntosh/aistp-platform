import { ArrowRight } from "lucide-react";
import { RichText } from "../utils/richText";
import Alert from "./ui/Alert";
import Button from "./ui/Button";

export default function StudyContentReader({ domainName, topicTitle, topicPosition, topicCount, content, onContinue, hasQuestions }) {
  return (
    <article className="min-w-0 flex-1">
      <p className="text-label uppercase tracking-wide text-study">{domainName}</p>
      {topicPosition != null && topicCount != null && (
        <p className="mt-0.5 text-caption text-text-muted">
          Topic {topicPosition} of {topicCount}
        </p>
      )}
      <h1 className="mt-2 text-h1 text-text-primary">{topicTitle}</h1>

      <div className="mt-7 max-w-prose">
        {content ? (
          <RichText text={content.content} variant="reading" />
        ) : (
          <Alert tone="warning">The reading for this topic hasn&apos;t been published yet.</Alert>
        )}
      </div>

      {onContinue && (
        <Button tone="study" size="lg" onClick={onContinue} className="mt-9">
          {hasQuestions ? "Continue to knowledge check" : "Finish topic"}
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Button>
      )}
    </article>
  );
}
