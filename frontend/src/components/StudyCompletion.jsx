import Link from "next/link";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import Button from "./ui/Button";
import { Card } from "./ui/Card";

export default function StudyCompletion({ domainName, topicTitle, questionsAnswered, nextTopic }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-16 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-success-muted text-success" aria-hidden="true">
        <CheckCircle2 className="h-7 w-7" />
      </span>
      <h2 className="mt-4 text-h1 text-text-primary">Lesson complete</h2>

      <Card className="mt-5 w-full max-w-sm p-5 text-left">
        <p className="text-label uppercase tracking-wide text-text-muted">You&apos;ve reviewed</p>
        <p className="mt-1 text-body-sm text-text-muted">{domainName}</p>
        <p className="text-body font-semibold text-text-primary">{topicTitle}</p>
      </Card>

      <p className="mt-4 max-w-sm text-body text-text-muted">
        You&apos;ve read the topic and finished the knowledge check.
      </p>
      {questionsAnswered > 0 && (
        <p className="mt-1 text-caption text-text-muted">
          {questionsAnswered} learning question{questionsAnswered === 1 ? "" : "s"} completed.
        </p>
      )}

      {nextTopic && (
        <Card className="mt-6 w-full max-w-sm border-study/25 bg-study-muted p-4 text-left">
          <p className="text-label uppercase tracking-wide text-study">Suggested next topic</p>
          <p className="mt-1 text-body font-semibold text-text-primary">{nextTopic.title}</p>
          <Button href={`/study/${nextTopic.domain_id}/${nextTopic.id}`} tone="study" className="mt-3 w-full">
            Continue learning
          </Button>
        </Card>
      )}

      <Link href="/study" className="mt-6 flex items-center gap-1 text-body-sm font-medium text-text-muted hover:text-text-primary">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to Study Mode
      </Link>
    </div>
  );
}
