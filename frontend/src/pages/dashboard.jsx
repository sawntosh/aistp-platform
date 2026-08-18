import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { useAuth } from "../context/AuthContext";
import { fetchDashboardAnalytics } from "../services/analyticsService";
import { useCountUp } from "../hooks/useCountUp";
import AccuracyRing from "../components/AccuracyRing";
import DomainAccuracyBars from "../components/DomainAccuracyBars";
import AttemptHistoryTable from "../components/AttemptHistoryTable";

const RANGE_OPTIONS = [
  { label: "Last 5", value: 5 },
  { label: "Last 10", value: 10 },
  { label: "All time", value: null },
];

function weightedAccuracy(sessions) {
  const totalQuestions = sessions.reduce((sum, s) => sum + s.question_count, 0);
  if (!totalQuestions) return 0;
  const totalScore = sessions.reduce((sum, s) => sum + (s.score ?? 0), 0);
  return Math.round((totalScore / totalQuestions) * 1000) / 10;
}

function computeStreak(sessions) {
  const days = new Set(sessions.filter((s) => s.finished_at).map((s) => new Date(s.finished_at).toDateString()));
  if (!days.size) return 0;

  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);

  if (!days.has(cursor.toDateString())) {
    cursor.setDate(cursor.getDate() - 1);
    if (!days.has(cursor.toDateString())) return 0;
  }

  let streak = 0;
  while (days.has(cursor.toDateString())) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export default function DashboardPage() {
  const router = useRouter();
  const { user, isLoading: isAuthLoading } = useAuth();

  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [sessionLimit, setSessionLimit] = useState(10);

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

  const completedSessions = sessions.filter((s) => s.finished_at);
  const sortedCompletedDesc = [...completedSessions].sort(
    (a, b) => new Date(b.started_at) - new Date(a.started_at)
  );
  const sortedAllDesc = [...sessions].sort((a, b) => new Date(b.started_at) - new Date(a.started_at));

  const currentWindow = sessionLimit ? sortedCompletedDesc.slice(0, sessionLimit) : sortedCompletedDesc;
  const previousWindow = sessionLimit
    ? sortedCompletedDesc.slice(sessionLimit, sessionLimit * 2)
    : [];

  const rangeAccuracy = sessionLimit ? weightedAccuracy(currentWindow) : data?.overall_accuracy ?? 0;
  const previousRangeAccuracy = previousWindow.length ? weightedAccuracy(previousWindow) : null;
  const delta = previousRangeAccuracy !== null ? Math.round(rangeAccuracy - previousRangeAccuracy) : null;

  const questionsAnswered = completedSessions.reduce((sum, s) => sum + s.question_count, 0);
  const streak = computeStreak(sessions);

  const filteredSessions = sessionLimit ? sortedAllDesc.slice(0, sessionLimit) : sortedAllDesc;

  const animatedAccuracy = useCountUp(rangeAccuracy);
  const animatedSessions = useCountUp(completedSessions.length);
  const animatedQuestions = useCountUp(questionsAnswered);

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

  return (
    <div className="relative min-h-[calc(100vh-49px)] bg-gray-50 px-4 py-10">
      <Link
        href="/practice"
        className="absolute top-6 left-4 flex items-center justify-center w-10 h-10 rounded-full bg-white/70 shadow-sm transition hover:bg-white"
        aria-label="Go to practice"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polygon points="6 3 20 12 6 21 6 3" />
        </svg>
      </Link>

      <div className="mx-auto max-w-5xl">
        <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">
              CTFL Practice &middot; Performance
            </p>
            <h1 className="mt-1 font-serif text-3xl text-gray-900">Your Performance Report</h1>
            <p className="mt-1 text-sm text-gray-500">
              Updated moments ago &middot; based on {completedSessions.length} completed session
              {completedSessions.length === 1 ? "" : "s"}
            </p>
          </div>

          <div className="inline-flex rounded-md bg-gray-100 p-0.5">
            {RANGE_OPTIONS.map((option) => (
              <button
                key={option.label}
                type="button"
                onClick={() => setSessionLimit(option.value)}
                className={`rounded px-3 py-1.5 text-sm font-medium transition-colors ${
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

        <div className="mb-6 rounded-2xl border border-gray-100 bg-white p-8 shadow-sm">
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
            <div className="flex items-center gap-6">
              <AccuracyRing percent={animatedAccuracy} />
              <div>
                <p className="text-sm text-gray-500">Overall accuracy, all domains</p>
                {delta !== null && (
                  <p
                    className={`mt-2 inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
                      delta >= 0 ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
                    }`}
                  >
                    {delta >= 0 ? "↑" : "↓"} {Math.abs(delta)} pts vs. previous {sessionLimit} sessions
                  </p>
                )}
              </div>
            </div>

            <div className="divide-y divide-gray-100 sm:border-l sm:border-gray-100 sm:pl-8">
              <div className="flex items-center justify-between py-2.5">
                <span className="text-sm text-gray-500">Sessions completed</span>
                <span className="text-lg font-semibold tabular-nums text-gray-900">
                  {Math.round(animatedSessions)}
                </span>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <span className="text-sm text-gray-500">Questions answered</span>
                <span className="text-lg font-semibold tabular-nums text-gray-900">
                  {Math.round(animatedQuestions)}
                </span>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <span className="text-sm text-gray-500">Current streak</span>
                <span className="text-lg font-semibold tabular-nums text-gray-900">
                  {streak} <span className="text-sm font-normal text-gray-400">days</span>
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="mb-6 rounded-xl bg-white p-6 shadow-sm">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-serif text-xl text-gray-900">Accuracy by domain</h2>
            <p className="text-xs text-gray-400">Ranked weakest first &middot; 60% is the practice threshold</p>
          </div>
          <DomainAccuracyBars domains={domains} />
        </div>

        <div className="rounded-xl bg-white shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-6 pt-6 pb-4">
            <h2 className="font-serif text-xl text-gray-900">Session history</h2>
            <p className="text-xs text-gray-400">Click a column to sort</p>
          </div>
          <AttemptHistoryTable sessions={filteredSessions} />
        </div>
      </div>
    </div>
  );
}
