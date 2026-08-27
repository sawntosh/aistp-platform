import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { Circle, CircleDot, CheckCircle2 } from "lucide-react";
import { useAuth } from "../../../context/AuthContext";
import { fetchStudyTopics } from "../../../services/studyService";
import PageHeader from "../../../components/ui/PageHeader";
import Skeleton from "../../../components/ui/Skeleton";
import ErrorState from "../../../components/ui/ErrorState";
import EmptyState from "../../../components/ui/EmptyState";
import Badge from "../../../components/ui/Badge";
import { cn } from "../../../lib/cn";

const STATUS_CONFIG = {
  not_started: { label: "Not started", tone: "default", icon: Circle },
  in_progress: { label: "In progress", tone: "study", icon: CircleDot },
  completed: { label: "Completed", tone: "success", icon: CheckCircle2 },
};

export default function StudyDomainTopicsPage() {
  const router = useRouter();
  const { domainId } = router.query;
  const { user, isLoading: isAuthLoading } = useAuth();

  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    if (!isAuthLoading && !user) {
      router.replace("/login");
    }
  }, [isAuthLoading, user, router]);

  async function loadTopics() {
    setLoadError("");
    setData(null);
    try {
      setData(await fetchStudyTopics(domainId));
    } catch {
      setLoadError("Couldn't load this domain's topics right now.");
    }
  }

  useEffect(() => {
    if (user && domainId) loadTopics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, domainId]);

  if (isAuthLoading || !user) return null;

  return (
    <div className="min-h-[calc(100vh-57px)] sm:min-h-screen bg-background px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-2xl">
        {data === null && !loadError && (
          <div className="space-y-3" aria-busy="true" aria-label="Loading topics">
            <Skeleton className="mb-6 h-9 w-64" />
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-[72px] w-full" />
            ))}
          </div>
        )}

        {loadError && (
          <>
            <PageHeader backHref="/study" backLabel="Study" title="Topics" />
            <ErrorState description={loadError} onRetry={loadTopics} />
          </>
        )}

        {data && (
          <>
            <PageHeader
              backHref="/study"
              backLabel="Study"
              eyebrow={data.domain.name}
              title="Choose a topic"
              description="Pick a topic to start learning."
            />

            {data.topics.length === 0 ? (
              <EmptyState title="No topics yet" description="Topics for this domain will appear here once they're available." />
            ) : (
              <ul className="space-y-3">
                {data.topics.map((topic) => {
                  const status = STATUS_CONFIG[topic.status] ?? STATUS_CONFIG.not_started;
                  const StatusIcon = status.icon;
                  const disabled = !topic.has_content;
                  return (
                    <li key={topic.id}>
                      <Link
                        href={disabled ? "#" : `/study/${domainId}/${topic.id}`}
                        aria-disabled={disabled}
                        onClick={(event) => {
                          if (disabled) event.preventDefault();
                        }}
                        className={cn(
                          "flex items-center justify-between gap-4 rounded-lg border border-border bg-surface p-4 transition-all duration-150",
                          disabled ? "cursor-not-allowed opacity-50" : "hover:border-study/40 hover:shadow-sm"
                        )}
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          {!disabled && <StatusIcon className="h-4 w-4 shrink-0 text-text-muted" aria-hidden="true" />}
                          <div className="min-w-0">
                            <p className="truncate text-body font-semibold text-text-primary">{topic.title}</p>
                            {topic.description && <p className="mt-0.5 truncate text-body-sm text-text-muted">{topic.description}</p>}
                            {!disabled && (
                              <p className="mt-1 text-caption text-text-muted">
                                {topic.question_count} practice question{topic.question_count === 1 ? "" : "s"}
                              </p>
                            )}
                          </div>
                        </div>
                        <Badge tone={disabled ? "default" : status.tone} className="shrink-0">
                          {disabled ? "Coming soon" : status.label}
                        </Badge>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}
      </div>
    </div>
  );
}
