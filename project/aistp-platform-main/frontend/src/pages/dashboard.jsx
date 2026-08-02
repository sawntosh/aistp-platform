import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { useAuth } from "../context/AuthContext";
import { fetchDashboardAnalytics } from "../services/analyticsService";
import { useCountUp } from "../hooks/useCountUp";
import DomainAccuracyChart from "../components/DomainAccuracyChart";
import ScoreTrendChart from "../components/ScoreTrendChart";
import AttemptHistoryTable from "../components/AttemptHistoryTable";

const RANGE_OPTIONS = [
  { label: "Last 5", value: 5 },
  { label: "Last 10", value: 10 },
  { label: "All time", value: null },
];

export default function DashboardPage() {
  const router = useRouter();
  const { user, isLoading: isAuthLoading } = useAuth();

  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [sessionLimit, setSessionLimit] = useState(null);

  useEffect(() => {
    if (!isAuthLoading && !user) {
      router.replace("/login");
    }
  }, [isAuthLoading, user, router]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        setData(await fetchDashboardAnalytics());
      } catch {
        setLoadError("Couldn't load your analytics right now. Please try again.");
      } finally {
        setIsLoading(false);
      }
    })();
  }, [user]);

  const domains = data?.domains ?? [];
  const sessions = data?.sessions ?? [];
  const completedCount = sessions.filter((s) => s.finished_at).length;
  const weakestDomain = domains.length
    ? [...domains].sort((a, b) => a.accuracy_percent - b.accuracy_percent)[0]
    : null;

  const animatedAccuracy = useCountUp(data?.overall_accuracy ?? 0);
  const animatedSessions = useCountUp(completedCount);

  if (isAuthLoading || !user) return null;

  if (isLoading) {
    return (
      <div className="min-h-[calc(100vh-49px)] flex items-center justify-center text-gray-500">
        Loading your analytics…
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-[calc(100vh-49px)] flex items-center justify-center text-red-600">
        {loadError}
      </div>
    );
  }

  const sortedByDate = [...sessions].sort((a, b) => new Date(b.started_at) - new Date(a.started_at));
  const filteredSessions = sessionLimit ? sortedByDate.slice(0, sessionLimit) : sessions;

  return (
    <div className="min-h-[calc(100vh-49px)] bg-gray-50 px-4 py-10">
      <div className="mx-auto max-w-5xl">
        <h1 className="text-2xl font-semibold text-gray-900 mb-1">Your analytics</h1>
        <p className="text-sm text-gray-500 mb-6">
          Accuracy by domain and your practice session history.
        </p>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 mb-6">
          <div className="flex items-start gap-3 rounded-xl bg-white p-5 shadow transition-shadow hover:shadow-md">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 text-lg">
              🎯
            </span>
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-400">Overall accuracy</p>
              <p className="mt-1 text-3xl font-semibold tabular-nums text-gray-900">
                {Math.round(animatedAccuracy)}%
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-xl bg-white p-5 shadow transition-shadow hover:shadow-md">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 text-lg">
              ✅
            </span>
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-400">Sessions completed</p>
              <p className="mt-1 text-3xl font-semibold tabular-nums text-gray-900">
                {Math.round(animatedSessions)}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-xl bg-white p-5 shadow transition-shadow hover:shadow-md">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-500 to-rose-500 text-lg">
              ⚡
            </span>
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-400">Weakest domain</p>
              <p className="mt-1 text-lg font-semibold text-gray-900 truncate">
                {weakestDomain ? weakestDomain.domain : "—"}
              </p>
              {weakestDomain && (
                <p className="text-sm text-gray-500">{weakestDomain.accuracy_percent}% accuracy</p>
              )}
            </div>
          </div>
        </div>

        <div className="mb-4 flex items-center justify-end gap-1">
          <span className="mr-1 text-xs font-medium uppercase tracking-wide text-gray-400">
            Session range
          </span>
          <div className="inline-flex rounded-md bg-gray-100 p-0.5">
            {RANGE_OPTIONS.map((option) => (
              <button
                key={option.label}
                type="button"
                onClick={() => setSessionLimit(option.value)}
                className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                  sessionLimit === option.value
                    ? "bg-white text-indigo-700 shadow-sm"
                    : "text-gray-500 hover:text-gray-900"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 mb-6">
          <div className="rounded-xl bg-white p-6 shadow">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">Accuracy by domain</h2>
            <DomainAccuracyChart domains={domains} />
          </div>
          <div className="rounded-xl bg-white p-6 shadow">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">Accuracy trend</h2>
            <ScoreTrendChart sessions={filteredSessions} />
          </div>
        </div>

        <div className="rounded-xl bg-white shadow overflow-hidden">
          <h2 className="text-sm font-semibold text-gray-900 px-6 pt-6 pb-4">Session history</h2>
          <AttemptHistoryTable sessions={filteredSessions} />
        </div>
      </div>
    </div>
  );
}
