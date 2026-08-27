import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { Brain, Check, ClipboardCheck, FolderKanban, Puzzle, RefreshCw, Search, Sliders, Target, Wrench } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { usePracticeSession } from "../context/PracticeSessionContext";
import {
  fetchDomains,
  fetchPracticeQuestions,
  fetchSessionReview,
  finishSession,
  submitAnswer,
} from "../services/questionsService";
import { fetchDashboardAnalytics } from "../services/analyticsService";
import QuestionCard from "../components/QuestionCard";
import FeedbackPanel from "../components/FeedbackPanel";
import ConfirmModal from "../components/ConfirmModal";
import WeakestDomainsPanel from "../components/WeakestDomainsPanel";
import Alert from "../components/ui/Alert";
import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import Progress from "../components/ui/Progress";
import { getDomainColor } from "../utils/domainColors";
import { cn } from "../lib/cn";

const DOMAIN_ICONS = [Puzzle, RefreshCw, Search, Brain, FolderKanban, Wrench];

const SESSION_LENGTHS = [
  { value: 10, label: "Quick", minutes: "~10 min" },
  { value: 20, label: "Standard", minutes: "~20 min" },
  { value: 40, label: "Deep dive", minutes: "~40 min" },
];

const MIN_CUSTOM_LENGTH = 5;
const MAX_CUSTOM_LENGTH = 60;
const WEAKEST_DOMAIN_COUNT = 3;

const MODES = [
  {
    value: "practice",
    label: "Practice Mode",
    icon: Target,
    description: "Instant feedback, AI explanations, and domain resources after every question.",
  },
  {
    value: "test",
    label: "Test Mode",
    icon: ClipboardCheck,
    description: "Simulate the real exam — answers, explanations, and links are revealed only once you finish.",
  },
];

function OptionTile({ isSelected, onClick, children, className = "" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={isSelected}
      className={cn(
        "cursor-pointer rounded-lg border-2 p-4 text-left transition-all duration-150",
        isSelected ? "border-test bg-test-muted shadow-xs" : "border-border bg-surface hover:border-test/40 hover:bg-test-muted/40",
        className
      )}
    >
      {children}
    </button>
  );
}

export default function PracticePage() {
  const router = useRouter();
  const { user, isLoading: isAuthLoading } = useAuth();
  const { setIsActive: setSessionLocked } = usePracticeSession();

  const [domains, setDomains] = useState([]);
  const [sessionStarted, setSessionStarted] = useState(false);
  const [selectedDomainIds, setSelectedDomainIds] = useState([]);
  const [sessionLength, setSessionLength] = useState(10);
  const [isCustomLength, setIsCustomLength] = useState(false);
  const [customLengthInput, setCustomLengthInput] = useState("15");
  const [mode, setMode] = useState("practice");

  // Personalized "focus areas" sidebar: weakest domains from past sessions.
  const [domainAccuracy, setDomainAccuracy] = useState(null);
  const [analyticsStatus, setAnalyticsStatus] = useState("guest"); // guest | loading | ready

  // The full ordered question list for the session. Questions stay in place
  // (unlike the old one-at-a-time queue) so the learner can page back and
  // forth freely; PER_PAGE of them show at once. Per-question answer /
  // result / submitted state lives in the *ById maps, keyed by question id.
  const PER_PAGE = 5;
  const [questions, setQuestions] = useState([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [sessionId, setSessionId] = useState(null);
  const [answersById, setAnswersById] = useState({});
  // Practice Mode only -- in Test Mode the backend withholds correctness on
  // submit (see AnswerSubmitView), so resultsById stays empty and the real
  // answers only arrive with `testReview` once the session finishes.
  const [resultsById, setResultsById] = useState({});
  const [submittedIds, setSubmittedIds] = useState(() => new Set());
  const [correctCount, setCorrectCount] = useState(0);
  const [finalScore, setFinalScore] = useState(null);
  const [testReview, setTestReview] = useState(null);
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(false);
  const [submittingId, setSubmittingId] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [isSessionComplete, setIsSessionComplete] = useState(false);
  const [showEndConfirm, setShowEndConfirm] = useState(false);

  // Domains are public, so even guests browsing before login see real names.
  useEffect(() => {
    fetchDomains()
      .then(setDomains)
      .catch(() => {});
  }, []);

  // Weakest-domain suggestions need a logged-in session's accuracy history.
  useEffect(() => {
    if (!user) {
      setAnalyticsStatus("guest");
      return;
    }
    setAnalyticsStatus("loading");
    fetchDashboardAnalytics()
      .then((data) => {
        setDomainAccuracy(data.domains ?? []);
        setAnalyticsStatus("ready");
      })
      .catch(() => setAnalyticsStatus("guest"));
  }, [user]);

  // Cross-reference analytics (domain name + accuracy) with the domain
  // filter list (id + name) so "Add to session" can toggle a real filter.
  const weakestDomains = useMemo(() => {
    if (!domainAccuracy) return [];
    return domainAccuracy
      .filter((d) => d.total_count > 0)
      .sort((a, b) => a.accuracy_percent - b.accuracy_percent)
      .slice(0, WEAKEST_DOMAIN_COUNT)
      .map((d) => ({ ...d, id: domains.find((domain) => domain.name === d.domain)?.id ?? null }));
  }, [domainAccuracy, domains]);

  // Lock the rest of the app's navigation while a session has questions left
  // to answer, so a stray click can't abandon it without going through the
  // end-practice confirmation.
  useEffect(() => {
    setSessionLocked(sessionStarted && !isSessionComplete);
  }, [sessionStarted, isSessionComplete, setSessionLocked]);
  useEffect(() => () => setSessionLocked(false), [setSessionLocked]);

  function toggleDomain(domainId) {
    setSelectedDomainIds((prev) =>
      prev.includes(domainId) ? prev.filter((id) => id !== domainId) : [...prev, domainId]
    );
  }

  function addDomainFilter(domainId) {
    setSelectedDomainIds((prev) => (prev.includes(domainId) ? prev : [...prev, domainId]));
  }

  function handleCustomLengthChange(raw) {
    setCustomLengthInput(raw);
    const parsed = parseInt(raw, 10);
    if (Number.isNaN(parsed)) return;
    setSessionLength(Math.min(MAX_CUSTOM_LENGTH, Math.max(MIN_CUSTOM_LENGTH, parsed)));
  }

  async function startSession() {
    // Guests can browse this setup screen freely, but need an account to
    // actually start practicing.
    if (!user) {
      router.push("/login");
      return;
    }

    setLoadError("");
    setIsLoadingQuestions(true);
    try {
      const data = await fetchPracticeQuestions(sessionLength, selectedDomainIds, mode);
      setQuestions(data.questions);
      setTotalCount(data.questions.length);
      setCurrentPage(0);
      setSessionId(data.session_id);
      setAnswersById({});
      setResultsById({});
      setSubmittedIds(new Set());
      setCorrectCount(0);
      setFinalScore(null);
      setTestReview(null);
      setIsSessionComplete(false);
      setSessionStarted(true);
    } catch {
      setLoadError("Couldn't load practice questions. Please try again.");
    } finally {
      setIsLoadingQuestions(false);
    }
  }

  function backToSetup() {
    setSessionStarted(false);
    setQuestions([]);
    setIsSessionComplete(false);
    setLoadError("");
  }

  const pageCount = Math.max(1, Math.ceil(questions.length / PER_PAGE));
  const pageStart = currentPage * PER_PAGE;
  const pageQuestions = questions.slice(pageStart, pageStart + PER_PAGE);
  const answeredCount = submittedIds.size;
  const allAnswered = questions.length > 0 && answeredCount === questions.length;

  function goToQuestion(index) {
    setCurrentPage(Math.floor(index / PER_PAGE));
    setLoadError("");
  }

  function handleAnswerChange(questionId, nextAnswer) {
    if (submittedIds.has(questionId)) return;
    setAnswersById((prev) => ({ ...prev, [questionId]: nextAnswer }));
    setLoadError("");
  }

  // Builds the AnswerSubmitSerializer payload shape for the current
  // question's type -- see services/questionsService.js#submitAnswer.
  function buildAnswerPayload(question, value) {
    switch (question.question_type) {
      case "multi_select":
        return { selected_option_ids: value };
      case "fill_blank":
        return { text_answer: value };
      case "matching":
        return { matching_response: value };
      default: // mcq / true_false
        return { selected_option_id: value };
    }
  }

  // Human-readable "correct answer" summary shown by FeedbackPanel when
  // the learner got it wrong -- shape of `data` depends on question_type.
  function describeCorrectAnswer(question, data) {
    switch (question.question_type) {
      case "multi_select":
        return (data.correct_option_texts ?? []).join(", ");
      case "fill_blank":
        return data.correct_answer ?? "";
      case "matching":
        return question.matching_pairs
          .map((pair) => `${pair.prompt_text} → ${data.correct_pairing?.[pair.id]}`)
          .join("; ");
      default: // mcq / true_false
        return data.correct_option_text ?? "";
    }
  }

  // Test Mode review only: human-readable summary of what the learner
  // actually submitted, from SessionReviewView's `your_answer` shape.
  function describeYourAnswer(item) {
    const submitted = item.your_answer ?? {};
    switch (item.question_type) {
      case "multi_select":
        return (submitted.selected_option_texts ?? []).join(", ") || "No answer";
      case "fill_blank":
        return submitted.text_answer?.trim() ? submitted.text_answer : "No answer";
      case "matching":
        return item.matching_pairs
          .map((pair) => `${pair.prompt_text} → ${submitted.matching_response?.[pair.id] ?? "—"}`)
          .join("; ");
      default: // mcq / true_false
        return submitted.selected_option_text ?? "No answer";
    }
  }

  async function handleSubmit(questionId) {
    if (submittedIds.has(questionId) || submittingId) return;
    const question = questions.find((q) => q.id === questionId);
    if (!question) return;
    setSubmittingId(questionId);
    try {
      const data = await submitAnswer({
        sessionId,
        questionId,
        answer: buildAnswerPayload(question, answersById[questionId]),
      });
      setSubmittedIds((prev) => new Set(prev).add(questionId));
      if (mode !== "test") {
        setResultsById((prev) => ({
          ...prev,
          [questionId]: {
            isCorrect: data.is_correct,
            correctOptionId: data.correct_option_id,
            correctOptionIds: data.correct_option_ids,
            correctOptionTexts: data.correct_option_texts,
            correctAnswer: data.correct_answer,
            correctPairing: data.correct_pairing,
            correctAnswerText: describeCorrectAnswer(question, data),
          },
        }));
        if (data.is_correct) setCorrectCount((c) => c + 1);
      }
    } catch {
      setLoadError("Couldn't submit your answer. Please try again.");
    } finally {
      setSubmittingId(null);
    }
  }

  // Best-effort: finishes the session and, for Test Mode, loads the
  // deferred per-question reveal. A failure here shouldn't block the
  // learner from seeing their local score -- it just means the session
  // won't show as "Completed" on analytics, or the review won't load.
  async function finalizeSession() {
    try {
      const finishData = await finishSession(sessionId);
      setFinalScore(finishData.score);
      if (mode === "test") {
        const review = await fetchSessionReview(sessionId);
        setTestReview(review);
      }
    } catch {
      // Best-effort -- see comment above.
    }
  }

  function requestFinish() {
    if (allAnswered) {
      endSession();
    } else {
      setShowEndConfirm(true);
    }
  }

  async function endSession() {
    setShowEndConfirm(false);
    await finalizeSession();
    setIsSessionComplete(true);
  }

  if (isAuthLoading) return null;

  if (!sessionStarted) {
    return (
      <div className="min-h-[calc(100vh-57px)] sm:min-h-screen bg-background px-4 py-10 sm:px-6">
        <div className="mx-auto grid max-w-5xl grid-cols-1 gap-8 lg:grid-cols-[1fr_320px] lg:items-start">
        <div className="space-y-8">
          <div>
            {user && <p className="mb-1 text-body-sm font-medium text-test">Welcome back, {user.username}</p>}
            <h1 className="text-h1 text-text-primary">Start a practice session</h1>
            {!user && (
              <p className="mt-1 text-body-sm text-text-muted">
                Browse the options below freely — you&apos;ll only need an account once you&apos;re ready to
                answer questions.
              </p>
            )}
          </div>

          {!user && (
            <Card className="border-test/25 bg-test-muted p-5">
              <h2 className="text-body-sm font-semibold text-text-primary">What&apos;s in a practice session?</h2>
              <ul className="mt-3 list-inside list-disc space-y-2 text-body-sm text-text-secondary">
                <li>Real exam-style multiple choice questions across all 6 CTFL v4.0 knowledge domains.</li>
                <li>
                  Practice Mode gives instant feedback, AI explanations, and domain resource links after every
                  question — Test Mode holds all of that back until you finish, just like the real exam.
                </li>
                <li>
                  AI-generated explanations for why an answer is right or wrong, tied back to the specific
                  concept being tested.
                </li>
                <li>Every attempt feeds your analytics dashboard, so you can see exactly which domains need more work.</li>
              </ul>
            </Card>
          )}

          {loadError && <Alert tone="error">{loadError}</Alert>}

          <div>
            <h2 className="mb-3 text-label text-text-secondary">Mode</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {MODES.map((option) => {
                const isSelected = mode === option.value;
                const Icon = option.icon;
                return (
                  <OptionTile key={option.value} isSelected={isSelected} onClick={() => setMode(option.value)}>
                    <span className="flex items-center gap-2">
                      <Icon className={cn("h-4 w-4", isSelected ? "text-test" : "text-text-muted")} aria-hidden="true" />
                      <span className={cn("text-body-sm font-semibold", isSelected ? "text-test" : "text-text-primary")}>
                        {option.label}
                      </span>
                    </span>
                    <span className="mt-1 block text-body-sm text-text-muted">{option.description}</span>
                  </OptionTile>
                );
              })}
            </div>
          </div>

          <div>
            <h2 className="mb-1 text-label text-text-secondary">Filter by domain</h2>
            <p className="mb-3 text-caption text-text-muted">Optional — leave all unselected to practice every domain.</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {domains.map((domain, index) => {
                const isSelected = selectedDomainIds.includes(domain.id);
                const Icon = DOMAIN_ICONS[index % DOMAIN_ICONS.length];
                return (
                  <OptionTile key={domain.id} isSelected={isSelected} onClick={() => toggleDomain(domain.id)} className="flex items-center gap-3">
                    <span
                      className={cn(
                        "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
                        isSelected ? "bg-test text-white" : "bg-surface-muted text-text-muted"
                      )}
                    >
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <span className="min-w-0">
                      <span className={cn("block truncate text-body-sm font-semibold", isSelected ? "text-test" : "text-text-primary")}>
                        {domain.name}
                      </span>
                    </span>
                    {isSelected && (
                      <span className="ml-auto flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-test text-white">
                        <Check className="h-3 w-3" aria-hidden="true" />
                      </span>
                    )}
                  </OptionTile>
                );
              })}
            </div>
          </div>

          <div>
            <h2 className="mb-3 text-label text-text-secondary">Session length</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {SESSION_LENGTHS.map((option) => {
                const isSelected = !isCustomLength && sessionLength === option.value;
                return (
                  <OptionTile
                    key={option.value}
                    isSelected={isSelected}
                    onClick={() => {
                      setIsCustomLength(false);
                      setSessionLength(option.value);
                    }}
                    className="text-center"
                  >
                    <span className={cn("text-2xl font-bold tabular-nums", isSelected ? "text-test" : "text-text-primary")}>
                      {option.value}
                    </span>
                    <span className="mt-1 block text-caption font-semibold uppercase tracking-wide text-text-muted">{option.label}</span>
                    <span className="mt-0.5 block text-caption text-text-muted">{option.minutes}</span>
                  </OptionTile>
                );
              })}
              <OptionTile isSelected={isCustomLength} onClick={() => setIsCustomLength(true)} className="text-center">
                <span className="flex items-center justify-center">
                  <Sliders className={cn("h-6 w-6", isCustomLength ? "text-test" : "text-text-muted")} aria-hidden="true" />
                </span>
                <span className="mt-1 block text-caption font-semibold uppercase tracking-wide text-text-muted">Custom</span>
                <span className="mt-0.5 block text-caption text-text-muted">Pick your own</span>
              </OptionTile>
            </div>

            {isCustomLength && (
              <div className="mt-3 flex items-center gap-3 rounded-lg border border-test/25 bg-test-muted p-4 animate-fade-in">
                <label htmlFor="custom-length" className="text-body-sm font-medium text-text-primary">
                  Number of questions
                </label>
                <input
                  id="custom-length"
                  type="number"
                  min={MIN_CUSTOM_LENGTH}
                  max={MAX_CUSTOM_LENGTH}
                  value={customLengthInput}
                  onChange={(e) => handleCustomLengthChange(e.target.value)}
                  className="h-10 w-20 rounded-md border border-border-strong bg-surface px-3 text-center text-body font-semibold text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-test"
                />
                <span className="text-caption text-text-muted">
                  {MIN_CUSTOM_LENGTH}–{MAX_CUSTOM_LENGTH} questions
                </span>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-surface-muted px-5 py-4 text-body-sm">
            <div className="flex items-center gap-2 text-text-secondary">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-surface text-test shadow-xs">
                <ClipboardCheck className="h-4 w-4" aria-hidden="true" />
              </span>
              <span>
                <span className="font-semibold text-text-primary">{mode === "practice" ? "Practice Mode" : "Test Mode"}</span> ·{" "}
                <span className="font-semibold text-text-primary">{sessionLength} questions</span> from{" "}
                <span className="font-semibold text-text-primary">
                  {selectedDomainIds.length === 0
                    ? "all domains"
                    : `${selectedDomainIds.length} domain${selectedDomainIds.length > 1 ? "s" : ""}`}
                </span>
              </span>
            </div>
          </div>

          <Button tone="test" size="lg" onClick={startSession} isLoading={isLoadingQuestions} className="w-full">
            {isLoadingQuestions ? "Loading questions…" : user ? "Start session" : "Log in to start"}
          </Button>
        </div>

        <WeakestDomainsPanel
          status={analyticsStatus}
          domains={weakestDomains}
          selectedDomainIds={selectedDomainIds}
          onToggleDomain={addDomainFilter}
        />
        </div>
      </div>
    );
  }

  if (isSessionComplete) {
    const scoreValue = finalScore ?? correctCount;
    const scorePercent = totalCount ? Math.round((scoreValue / totalCount) * 100) : 0;
    const scoreTone = scorePercent >= 70 ? "text-success" : scorePercent >= 40 ? "text-warning" : "text-error";

    return (
      <div className="min-h-[calc(100vh-57px)] sm:min-h-screen bg-background px-4 py-10 sm:px-6">
        <div className="mx-auto max-w-2xl space-y-6">
          <Card className="p-8 text-center animate-pop">
            <h1 className="mb-2 text-h1 text-text-primary">{mode === "test" ? "Test complete" : "Session complete"}</h1>
            <p className={cn("mb-1 text-3xl font-semibold", scoreTone)}>
              {scoreValue} / {totalCount}
            </p>
            <p className="mb-6 text-body-sm text-text-muted">{scorePercent}% correct</p>
            <Button tone="test" onClick={backToSetup} className="w-full">
              Start another session
            </Button>
          </Card>

          {mode === "test" && testReview && (
            <div className="space-y-4">
              <h2 className="text-h2 text-text-primary">Review your answers</h2>
              {testReview.results.map((item, index) => {
                const domainColor = getDomainColor(item.domain?.name);
                return (
                  <Card key={item.question_id} className="p-5">
                    <div className="mb-2 flex items-center justify-between">
                      <span className={cn("inline-block rounded-full px-3 py-1 text-caption font-medium", domainColor.bg, domainColor.text)}>
                        {item.domain?.name}
                      </span>
                      <span className="text-caption font-medium uppercase tracking-wide text-text-muted">Question {index + 1}</span>
                    </div>
                    <p className="mb-2 text-body-sm font-medium text-text-primary">{item.text}</p>
                    <p className="mb-3 text-body-sm text-text-secondary">
                      Your answer: <span className="font-medium text-text-primary">{describeYourAnswer(item)}</span>
                    </p>
                    <FeedbackPanel
                      isCorrect={item.is_correct}
                      correctOptionText={describeCorrectAnswer(
                        { question_type: item.question_type, matching_pairs: item.matching_pairs },
                        item
                      )}
                      questionId={item.question_id}
                      domain={item.domain}
                      hideNext
                    />
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  const progressPercent = totalCount ? (answeredCount / totalCount) * 100 : 0;
  const isLastPage = currentPage >= pageCount - 1;

  return (
    <div className="min-h-[calc(100vh-57px)] sm:min-h-screen bg-background px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-2xl">
        <div className="mb-2 flex items-center justify-between text-body-sm text-text-muted">
          <span>
            Questions {pageStart + 1}–{Math.min(pageStart + PER_PAGE, questions.length)} of {totalCount}
            <span className="ml-2 text-text-muted/70">· {answeredCount} answered</span>
          </span>
          <div className="flex items-center gap-2">
            {mode === "practice" && <Badge tone="test">Score: {correctCount}</Badge>}
            <button
              type="button"
              onClick={() => setShowEndConfirm(true)}
              className="cursor-pointer rounded-full border border-border px-2.5 py-0.5 text-caption font-medium text-text-muted transition-colors hover:border-error/30 hover:bg-error-muted hover:text-error"
            >
              End practice
            </button>
          </div>
        </div>

        <Progress value={progressPercent} tone="test" className="mb-4" />

        {/* Question navigator: jump to any question; filled = answered. */}
        <div className="mb-6 flex flex-wrap gap-1.5">
          {questions.map((q, index) => {
            const onThisPage = index >= pageStart && index < pageStart + PER_PAGE;
            const submitted = submittedIds.has(q.id);
            return (
              <button
                key={q.id}
                type="button"
                onClick={() => goToQuestion(index)}
                aria-current={onThisPage ? "true" : undefined}
                className={cn(
                  "h-7 w-7 rounded-md border text-caption font-medium tabular-nums transition-colors",
                  submitted
                    ? "border-test bg-test text-white"
                    : "border-border bg-surface text-text-muted hover:border-test/40",
                  onThisPage && "ring-2 ring-test/40 ring-offset-1"
                )}
              >
                {index + 1}
              </button>
            );
          })}
        </div>

        {pageQuestions.map((question) => {
          const submitted = submittedIds.has(question.id);
          const result = resultsById[question.id] ?? null;
          return (
            <div key={question.id} className="mb-6 animate-fade-in">
              <QuestionCard
                question={question}
                answer={answersById[question.id] ?? null}
                onAnswerChange={(next) => handleAnswerChange(question.id, next)}
                onSubmit={() => handleSubmit(question.id)}
                canSkip={false}
                isAnswered={submitted}
                isSubmitting={submittingId === question.id}
                result={result}
                mode={mode}
                hideAdvance
              />

              {mode === "practice" && result && (
                <FeedbackPanel
                  isCorrect={result.isCorrect}
                  correctOptionText={result.correctAnswerText}
                  questionId={question.id}
                  domain={question.domain}
                  hideNext
                />
              )}
            </div>
          );
        })}

        {loadError && (
          <Alert tone="error" className="mb-4">
            {loadError}
          </Alert>
        )}

        <div className="mt-2 flex items-center justify-between gap-3">
          <Button
            variant="outline"
            onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
            disabled={currentPage === 0}
          >
            Previous
          </Button>
          <span className="text-body-sm text-text-muted">
            Page {currentPage + 1} of {pageCount}
          </span>
          {isLastPage ? (
            <Button tone="test" onClick={requestFinish}>
              {mode === "test" ? "Finish test" : "Finish session"}
            </Button>
          ) : (
            <Button tone="test" onClick={() => setCurrentPage((p) => Math.min(pageCount - 1, p + 1))}>
              Next
            </Button>
          )}
        </div>
      </div>

      <ConfirmModal
        open={showEndConfirm}
        title={
          allAnswered
            ? "Finish this session?"
            : `${totalCount - answeredCount} question${totalCount - answeredCount === 1 ? "" : "s"} still unanswered`
        }
        message="Your progress so far will be saved, but you won't be able to resume these remaining questions."
        confirmLabel="End session"
        cancelLabel="Keep practicing"
        onConfirm={endSession}
        onCancel={() => setShowEndConfirm(false)}
      />
    </div>
  );
}
