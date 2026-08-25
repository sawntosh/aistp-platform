import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { useAuth } from "../../../context/AuthContext";
import { fetchStudyTopics } from "../../../services/studyService";

const STATUS_STYLE = {
  not_started: { label: "Not started", className: "bg-gray-100 text-gray-500" },
  in_progress: { label: "In progress", className: "bg-indigo-50 text-indigo-700" },
  completed: { label: "Completed", className: "bg-emerald-50 text-emerald-700" },
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
    <div className="min-h-[calc(100vh-49px)] bg-gray-50 px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <Link href="/study" className="text-sm font-medium text-gray-500 hover:text-gray-900">
          ← Study
        </Link>

        {data === null && !loadError && (
          <div className="mt-6 space-y-3" aria-busy="true" aria-label="Loading topics">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl border border-gray-100 bg-gray-100" />
            ))}
          </div>
        )}

        {loadError && (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-6 text-center">
            <p className="text-sm text-red-700">{loadError}</p>
            <button
              type="button"
              onClick={loadTopics}
              className="mt-3 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 active:scale-[0.98]"
            >
              Try again
            </button>
          </div>
        )}

        {data && (
          <>
            <h1 className="mt-3 text-2xl font-semibold text-gray-900">{data.domain.name}</h1>
            <p className="mt-1 text-sm text-gray-500">Choose a topic to start learning.</p>

            {data.topics.length === 0 ? (
              <p className="mt-6 rounded-xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-500">
                No topics are available for this domain yet.
              </p>
            ) : (
              <ul className="mt-6 space-y-3">
                {data.topics.map((topic) => {
                  const status = STATUS_STYLE[topic.status] ?? STATUS_STYLE.not_started;
                  const disabled = !topic.has_content;
                  return (
                    <li key={topic.id}>
                      <Link
                        href={disabled ? "#" : `/study/${domainId}/${topic.id}`}
                        aria-disabled={disabled}
                        onClick={(event) => {
                          if (disabled) event.preventDefault();
                        }}
                        className={`flex items-center justify-between gap-4 rounded-xl border-2 p-4 transition-all ${
                          disabled
                            ? "cursor-not-allowed border-gray-100 bg-gray-50 opacity-60"
                            : "border-gray-200 bg-white hover:border-indigo-300 hover:shadow-sm active:scale-[0.99]"
                        }`}
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-gray-900">{topic.title}</p>
                          {topic.description && <p className="mt-0.5 truncate text-xs text-gray-500">{topic.description}</p>}
                          {!disabled && (
                            <p className="mt-1 text-xs text-gray-400">
                              {topic.question_count} practice question{topic.question_count === 1 ? "" : "s"}
                            </p>
                          )}
                        </div>
                        <span
                          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
                            disabled ? "bg-gray-100 text-gray-400" : status.className
                          }`}
                        >
                          {disabled ? "Coming soon" : status.label}
                        </span>
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
