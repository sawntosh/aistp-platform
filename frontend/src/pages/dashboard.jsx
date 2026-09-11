import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { Award } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { fetchDashboardAnalytics } from "../services/analyticsService";
import { fetchMyCertificates } from "../services/certificatesService";
import { useCountUp } from "../hooks/useCountUp";
import AccuracyRing from "../components/AccuracyRing";
import DomainAccuracyBars from "../components/DomainAccuracyBars";
import AttemptHistoryTable from "../components/AttemptHistoryTable";
import ConfidenceInsights from "../components/ConfidenceInsights";
import StudyModeCard from "../components/StudyModeCard";
import { Card, CardContent } from "../components/ui/Card";
import { SectionHeader } from "../components/ui/PageHeader";
import Skeleton from "../components/ui/Skeleton";
import ErrorState from "../components/ui/ErrorState";
import SegmentedControl from "../components/ui/SegmentedControl";
import { cn } from "../lib/cn";

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

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export default function DashboardPage() {
  const router = useRouter();
  const { user, isLoading: isAuthLoading } = useAuth();

  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [sessionLimit, setSessionLimit] = useState(10);
  const [certificates, setCertificates] = useState([]);

  useEffect(() => {
    if (!isAuthLoading && !user) {
      router.replace("/login");
    }
  }, [isAuthLoading, user, router]);

  function loadAnalytics() {
    setIsLoading(true);
    setLoadError("");
    fetchDashboardAnalytics()
      .then(setData)
      .catch(() => setLoadError("Couldn't load your analytics. Try again."))
      .finally(() => setIsLoading(false));
  }

  useEffect(() => {
    if (!user) return;
    loadAnalytics();
    fetchMyCertificates()
      .then(setCertificates)
      .catch(() => setCertificates([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  return (
    <div className="min-h-[calc(100vh-57px)] sm:min-h-screen bg-background px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8">
          <h1 className="text-h1 text-text-primary">
            {greeting()}, {user.username}
          </h1>
          <p className="mt-1 text-body text-text-muted">Here&apos;s how your CTFL prep is going.</p>
        </div>

        <div className="mb-10 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <StudyModeCard
            variant="study"
            title="Study Mode"
            description="Read a topic, then answer a few questions on it."
            bullets={["No scores. No pressure."]}
            ctaLabel="Start studying"
            href="/study"
          />
          <StudyModeCard
            variant="test"
            title="Test Mode"
            description="Answer exam-style questions and track your score."
            bullets={["Scoring and analytics included."]}
            ctaLabel="Start test"
            href="/practice"
          />
        </div>

        {certificates.length > 0 && (
          <div className="mb-10">
            <SectionHeader
              title="Your certificates"
              description="Earned by passing a Real Exam at 65% or above"
              className="mb-4"
            />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {certificates.map((cert) => (
                <Link
                  key={cert.certificate_id}
                  href={`/certificate/${cert.certificate_id}`}
                  className="group flex items-center gap-4 rounded-lg border border-border bg-surface p-4 transition-colors hover:border-test/40 hover:bg-test-muted/30"
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-test-muted text-test">
                    <Award className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-body-sm font-semibold text-text-primary">
                      {cert.exam_label}
                    </p>
                    <p className="text-caption text-text-muted">
                      {cert.score_percent}% ·{" "}
                      {new Date(cert.issued_at).toLocaleDateString(undefined, {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}{" "}
                      · {cert.certificate_id}
                    </p>
                  </div>
                  <span className="ml-auto text-caption font-medium text-test opacity-0 transition-opacity group-hover:opacity-100">
                    View →
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="space-y-6">
            <Skeleton className="h-44 w-full" />
            <Skeleton className="h-56 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : loadError ? (
          <ErrorState description={loadError} onRetry={loadAnalytics} />
        ) : (
          <>
            <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-label uppercase tracking-wide text-primary">Your preparation</p>
                <h2 className="mt-1 text-h2 text-text-primary">Performance report</h2>
                <p className="mt-1 text-body-sm text-text-muted">
                  Based on {completedSessions.length} completed session
                  {completedSessions.length === 1 ? "" : "s"}
                </p>
              </div>

              <SegmentedControl options={RANGE_OPTIONS} value={sessionLimit} onChange={setSessionLimit} />
            </div>

            <Card className="mb-6">
              <CardContent className="grid grid-cols-1 gap-8 sm:grid-cols-2">
                <div className="flex items-center gap-6">
                  <AccuracyRing percent={animatedAccuracy} />
                  <div>
                    <p className="text-body-sm text-text-muted">Overall accuracy, all domains</p>
                    {delta !== null && (
                      <p
                        className={cn(
                          "mt-2 inline-flex items-center rounded-full px-2.5 py-1 text-caption font-medium",
                          delta >= 0 ? "bg-success-muted text-success" : "bg-error-muted text-error"
                        )}
                      >
                        {delta >= 0 ? "↑" : "↓"} {Math.abs(delta)} pts vs. previous {sessionLimit} sessions
                      </p>
                    )}
                  </div>
                </div>

                <div className="divide-y divide-border sm:border-l sm:border-border sm:pl-8">
                  <div className="flex items-center justify-between py-2.5">
                    <span className="text-body-sm text-text-muted">Sessions completed</span>
                    <span className="text-lg font-semibold tabular-nums text-text-primary">
                      {Math.round(animatedSessions)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-2.5">
                    <span className="text-body-sm text-text-muted">Questions answered</span>
                    <span className="text-lg font-semibold tabular-nums text-text-primary">
                      {Math.round(animatedQuestions)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-2.5">
                    <span className="text-body-sm text-text-muted">Current streak</span>
                    <span className="text-lg font-semibold tabular-nums text-text-primary">
                      {streak} <span className="text-body-sm font-normal text-text-muted">days</span>
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="mb-6">
              <CardContent>
                <SectionHeader
                  title="Accuracy by domain"
                  description="Ranked weakest first · 65% is the practice threshold"
                  className="mb-4"
                />
                <DomainAccuracyBars domains={domains} />
              </CardContent>
            </Card>

            <Card className="mb-6">
              <CardContent>
                <SectionHeader
                  title="Confidence insights"
                  description="From Test Mode · for insight only, not part of your score"
                  className="mb-4"
                />
                <ConfidenceInsights confidence={data?.confidence} />
              </CardContent>
            </Card>

            <Card className="overflow-hidden">
              <div className="flex items-center justify-between px-6 pt-6 pb-4">
                <h2 className="text-h3 text-text-primary">Session history</h2>
                <p className="text-caption text-text-muted">Click a column to sort</p>
              </div>
              <AttemptHistoryTable sessions={filteredSessions} />
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
