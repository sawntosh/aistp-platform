import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { AlertTriangle, ArrowRight, Award, Brain, Check, CircleSlash, ClipboardCheck, Download, FolderKanban, GraduationCap, Lightbulb, Puzzle, RefreshCw, Search, Sliders, Target, Wrench, X } from "lucide-react";
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
import {
  claimCertificate,
  fetchMyCertificates,
  certificatePdfUrl,
} from "../services/certificatesService";
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
    description: "Practice with feedback and explanations after each question.",
  },
  {
    value: "test",
    label: "Real Exam",
    icon: ClipboardCheck,
    description:
      "Answer every question, then submit to see your score and review the answers.",
  },
  {
    value: "mock",
    label: "ISTQB Mock Test",
    icon: GraduationCap,
    description:
      "Take a 40-question CTFL mock test using questions from the question bank.",
  },
];

// ISTQB CTFL Foundation Level standard pass mark. Presentation only — it
// does not change how the session is scored on the backend.
const EXAM_PASS_PERCENT = 65;

// The ISTQB Mock Test is a fixed-format 40-question paper by default; the
// length picker still lets a learner run a shorter self-test.
const MOCK_TEST_LENGTH = 40;

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
  // Test Mode only: the learner's 1-5 confidence per question, keyed by
  // question id like answersById so it survives navigation. Required
  // before a Test Mode answer can be submitted; cleared if the answer
  // changes so stale confidence never rides a new answer.
  const [confidenceById, setConfidenceById] = useState({});
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
  // Real Exam / Mock: the first "Submit" press while questions are still
  // unanswered jumps to the first of them instead of finishing. Only once
  // the learner has been walked to their skipped questions (or presses
  // Submit again without answering) does the real submit confirmation open.
  const [skipNoticeOpen, setSkipNoticeOpen] = useState(false);
  const [skipsAcknowledged, setSkipsAcknowledged] = useState(false);

  // Certificate (Real Exam, passed): claim it. The name is the username.
  const [claimedCert, setClaimedCert] = useState(null);
  const [claimingCert, setClaimingCert] = useState(false);
  const [claimError, setClaimError] = useState("");

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

  // "mock" is the ISTQB Mock Test. It shares the Real Exam behaviour
  // (answers locked in as you go, correctness/explanations withheld until
  // submission, then a full review) -- `isExamLike` -- but is its own
  // mode: MCQ only, no domain filter, no confidence rating, and a fixed
  // 40-question ISTQB paper by default.
  const isMock = mode === "mock";
  const isExamLike = mode === "test" || mode === "mock";

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
      // Only Practice Mode uses the domain filter. Real Exam and the
      // ISTQB Mock Test are always drawn from every domain, like the
      // real thing.
      const requestDomainIds = mode === "practice" ? selectedDomainIds : [];
      const data = await fetchPracticeQuestions(sessionLength, requestDomainIds, mode);
      setQuestions(data.questions);
      setTotalCount(data.questions.length);
      setCurrentPage(0);
      setSessionId(data.session_id);
      setAnswersById({});
      setConfidenceById({});
      setResultsById({});
      setSubmittedIds(new Set());
      setCorrectCount(0);
      setFinalScore(null);
      setTestReview(null);
      setIsSessionComplete(false);
      setSessionStarted(true);
    } catch (err) {
      // The ISTQB Mock Test returns a specific 422 + `diagnostic` when the
      // bank can't supply a full 40-question paper -- surface that message
      // verbatim, and log the diagnostic breakdown for development.
      if (err?.body?.diagnostic) {
        // eslint-disable-next-line no-console
        console.warn("ISTQB Mock Test unavailable:", err.body.diagnostic);
      }
      setLoadError(
        err?.body?.detail || "Couldn't load the questions. Try again."
      );
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
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  // Exam only: unlock a saved answer so it can be changed and re-submitted.
  function handleEditAnswer(questionId) {
    setSubmittedIds((prev) => {
      if (!prev.has(questionId)) return prev;
      const next = new Set(prev);
      next.delete(questionId);
      return next;
    });
    setResultsById((prev) => {
      if (!prev[questionId]) return prev;
      const next = { ...prev };
      delete next[questionId];
      return next;
    });
    setLoadError("");
  }

  function handleAnswerChange(questionId, nextAnswer) {
    if (submittedIds.has(questionId)) return;
    setAnswersById((prev) => ({ ...prev, [questionId]: nextAnswer }));
    // A changed answer invalidates any confidence rating already made for
    // the old answer -- the learner must re-rate the new one.
    setConfidenceById((prev) => {
      if (prev[questionId] == null) return prev;
      const next = { ...prev };
      delete next[questionId];
      return next;
    });
    setLoadError("");
  }

  function handleConfidenceChange(questionId, level) {
    if (submittedIds.has(questionId)) return;
    setConfidenceById((prev) => ({ ...prev, [questionId]: level }));
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
    if (item.skipped) return "Skipped — not answered";
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
    const confidence = confidenceById[questionId] ?? null;
    // Real Exam only: a 1-5 confidence rating is mandatory before an
    // answer can be submitted (QuestionCard also blocks the button; this
    // is the belt-and-braces guard). Practice Mode and the ISTQB Mock
    // Test don't collect confidence.
    if (mode === "test" && confidence == null) {
      setLoadError("Select how confident you are before submitting.");
      return;
    }
    setSubmittingId(questionId);
    try {
      const data = await submitAnswer({
        sessionId,
        questionId,
        answer: {
          ...buildAnswerPayload(question, answersById[questionId]),
          ...(confidence != null ? { confidence } : {}),
        },
      });
      setSubmittedIds((prev) => new Set(prev).add(questionId));
      // Answering something clears the "you have skipped questions" state,
      // so any that remain re-prompt on the next Submit press.
      setSkipsAcknowledged(false);
      setSkipNoticeOpen(false);
      // Practice Mode only. Real Exam and the ISTQB Mock Test withhold
      // correctness on submit (the backend returns nothing revealing), so
      // resultsById stays empty and QuestionCard shows no right/wrong
      // colouring until the post-submission review.
      if (!isExamLike) {
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
      if (isExamLike) {
        // Pass every served question id so the review can surface the ones
        // that were skipped, not just those that got an answer.
        const review = await fetchSessionReview(
          sessionId,
          questions.map((q) => q.id)
        );
        setTestReview(review);
      }
    } catch {
      // Best-effort -- see comment above.
    }
  }

  function firstUnansweredIndex() {
    return questions.findIndex((q) => !submittedIds.has(q.id));
  }

  function requestFinish() {
    // Real Exam / ISTQB Mock Test: submitting is a point of no return.
    if (isExamLike) {
      const skipIndex = firstUnansweredIndex();
      // Don't let a Submit press quietly finish the exam while questions
      // are still unanswered -- send the learner to the first one first.
      if (skipIndex !== -1 && !skipsAcknowledged) {
        goToQuestion(skipIndex);
        setSkipsAcknowledged(true);
        setLoadError("");
        setSkipNoticeOpen(true);
        return;
      }
      setShowEndConfirm(true);
      return;
    }
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

  // On the Real Exam results screen: check whether this session already
  // has a certificate.
  useEffect(() => {
    if (!isSessionComplete || mode !== "test") return;
    fetchMyCertificates()
      .then((list) => {
        const match = list.find((c) => c.session === sessionId);
        if (match) setClaimedCert(match);
      })
      .catch(() => {});
  }, [isSessionComplete, mode, sessionId]);

  async function handleClaimCertificate() {
    setClaimingCert(true);
    setClaimError("");
    try {
      const cert = await claimCertificate({ sessionId });
      setClaimedCert(cert);
    } catch (err) {
      setClaimError(err?.body?.detail || "Couldn't create your certificate. Try again.");
    } finally {
      setClaimingCert(false);
    }
  }

  if (isAuthLoading) return null;

  if (!sessionStarted) {
    return (
      <div className="min-h-[calc(100vh-57px)] sm:min-h-screen bg-background px-4 py-10 sm:px-6">
        <div
          className={cn(
            "mx-auto grid grid-cols-1 gap-8",
            mode === "practice" ? "max-w-5xl lg:grid-cols-[1fr_320px] lg:items-start" : "max-w-2xl"
          )}
        >
        <div className="space-y-8">
          <div>
            {user && <p className="mb-1 text-body-sm font-medium text-test">Welcome back, {user.username}</p>}
            <h1 className="text-h1 text-text-primary">
              {isMock
                ? "Set up your ISTQB Mock Test"
                : mode === "test"
                  ? "Set up your exam"
                  : "Start a practice session"}
            </h1>
            {!user && (
              <p className="mt-1 text-body-sm text-text-muted">
                Browse the options below freely — you&apos;ll only need an account once you&apos;re ready to
                answer questions.
              </p>
            )}
          </div>

          {!user && (
            <Card className="border-test/25 bg-test-muted p-5">
              <h2 className="text-body-sm font-semibold text-text-primary">What&apos;s in a session?</h2>
              <ul className="mt-3 list-inside list-disc space-y-2 text-body-sm text-text-secondary">
                <li>Exam-style questions across all six CTFL domains.</li>
                <li>
                  Practice Mode gives feedback and explanations as you go. Real Exam and ISTQB Mock Test
                  hold them until you submit.
                </li>
                <li>Your results feed a dashboard that shows which domains need work.</li>
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
                  <OptionTile
                    key={option.value}
                    isSelected={isSelected}
                    onClick={() => {
                      setMode(option.value);
                      // The ISTQB Mock Test defaults to a full 40-question
                      // paper; the length picker can still shorten it.
                      if (option.value === "mock") {
                        setIsCustomLength(false);
                        setSessionLength(MOCK_TEST_LENGTH);
                      }
                    }}
                  >
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

          {mode === "practice" && (
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
          )}

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
                <span className="font-semibold text-text-primary">
                  {mode === "practice" ? "Practice Mode" : isMock ? "ISTQB Mock Test" : "Real Exam"}
                </span>{" "}
                ·{" "}
                <span className="font-semibold text-text-primary">{sessionLength} questions</span> from{" "}
                <span className="font-semibold text-text-primary">
                  {isMock
                    ? "all domains, multiple choice"
                    : mode === "test"
                      ? "all domains, all question types"
                      : selectedDomainIds.length === 0
                        ? "all domains"
                        : `${selectedDomainIds.length} domain${selectedDomainIds.length > 1 ? "s" : ""}`}
                </span>
              </span>
            </div>
          </div>

          <Button tone="test" size="lg" onClick={startSession} isLoading={isLoadingQuestions} className="w-full">
            {isLoadingQuestions
              ? "Loading questions…"
              : !user
                ? "Log in to start"
                : isMock
                  ? "Start mock test"
                  : mode === "test"
                    ? "Start exam"
                    : "Start session"}
          </Button>
        </div>

        {mode === "practice" && (
          <WeakestDomainsPanel
            status={analyticsStatus}
            domains={weakestDomains}
            selectedDomainIds={selectedDomainIds}
            onToggleDomain={addDomainFilter}
          />
        )}
        </div>
      </div>
    );
  }

  if (isSessionComplete) {
    const isExam = isExamLike;
    // Real Exam / Mock withhold correctness during the session, so `correctCount`
    // stays 0 -- trust the finished session's score (from the review payload,
    // falling back to the finish response) instead.
    const total = (isExam && testReview?.question_count) || totalCount;
    const scoreValue =
      (isExam ? testReview?.score : null) ?? finalScore ?? correctCount;
    const scorePercent = total ? Math.round((scoreValue / total) * 100) : 0;
    const scoreTone = scorePercent >= 70 ? "text-success" : scorePercent >= 40 ? "text-warning" : "text-error";
    const examPassed = scorePercent >= EXAM_PASS_PERCENT;
    const resultsTitle = isMock ? "ISTQB Mock Test results" : isExam ? "Exam results" : "Session complete";
    const skippedCount =
      testReview?.skipped_count ??
      testReview?.results?.filter((r) => r.skipped).length ??
      0;
    const incorrectCount = Math.max(total - scoreValue - skippedCount, 0);

    return (
      <div className="min-h-[calc(100vh-57px)] sm:min-h-screen bg-background px-4 py-10 sm:px-6">
        <div className="mx-auto max-w-2xl space-y-6">
          <Card className="p-8 text-center animate-pop">
            <h1 className="mb-2 text-h1 text-text-primary">{resultsTitle}</h1>
            {isExam && (
              <p
                className={cn(
                  "mx-auto mb-3 inline-flex items-center rounded-full px-3 py-1 text-body-sm font-semibold",
                  examPassed ? "bg-success-muted text-success" : "bg-error-muted text-error"
                )}
              >
                {examPassed ? "Pass" : "Fail"}
              </p>
            )}
            <p className={cn("mb-1 text-3xl font-semibold", scoreTone)}>
              {scoreValue} / {total}
            </p>
            <p className="mb-4 text-body-sm text-text-muted">
              {scorePercent}% correct
              {isExam && ` · ${EXAM_PASS_PERCENT}% required to pass (ISTQB CTFL standard)`}
            </p>
            {isExam && testReview && (
              <div className="mb-6 flex flex-wrap justify-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-success-muted px-3 py-1 text-caption font-semibold text-success">
                  <Check className="h-3 w-3" aria-hidden="true" />
                  {scoreValue} correct
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-error-muted px-3 py-1 text-caption font-semibold text-error">
                  <X className="h-3 w-3" aria-hidden="true" />
                  {incorrectCount} incorrect
                </span>
                {skippedCount > 0 && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-warning-muted px-3 py-1 text-caption font-semibold text-warning">
                    <CircleSlash className="h-3 w-3" aria-hidden="true" />
                    {skippedCount} skipped
                  </span>
                )}
              </div>
            )}
            <Button tone="test" onClick={backToSetup} className="w-full">
              {isMock ? "Start another mock test" : isExam ? "Start another exam" : "Start another session"}
            </Button>
          </Card>

          {isExam && !isMock && (
            <Card className="p-6">
              {!examPassed ? (
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-surface-muted text-text-muted">
                    <Award className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div>
                    <p className="text-body-sm font-semibold text-text-primary">
                      No certificate this time
                    </p>
                    <p className="text-caption text-text-muted">
                      Score {EXAM_PASS_PERCENT}% or higher on a Real Exam to earn your
                      AISTP certificate. You reached {scorePercent}%.
                    </p>
                  </div>
                </div>
              ) : claimedCert ? (
                <div className="flex flex-col items-center gap-3 text-center sm:flex-row sm:text-left">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-test-muted text-test">
                    <Award className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-body-sm font-semibold text-text-primary">
                      Your certificate is ready
                    </p>
                    <p className="text-caption text-text-muted">
                      Issued to {claimedCert.recipient_name} · ID {claimedCert.certificate_id}
                    </p>
                  </div>
                  <div className="flex flex-wrap justify-center gap-2">
                    <Button
                      href={`/certificate/${claimedCert.certificate_id}`}
                      tone="test"
                      size="sm"
                    >
                      View certificate
                    </Button>
                    <Button
                      href={certificatePdfUrl(claimedCert.certificate_id, { download: true })}
                      variant="outline"
                      size="sm"
                    >
                      <Download className="h-4 w-4" aria-hidden="true" />
                      PDF
                    </Button>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex flex-col items-center gap-3 text-center sm:flex-row sm:text-left">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-test-muted text-test">
                      <Award className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-body-sm font-semibold text-text-primary">
                        You passed — claim your certificate
                      </p>
                      <p className="text-caption text-text-muted">
                        It will be issued to {user?.username}.
                      </p>
                    </div>
                    <Button
                      tone="test"
                      onClick={handleClaimCertificate}
                      isLoading={claimingCert}
                    >
                      Get your certificate
                    </Button>
                  </div>
                  {claimError && (
                    <p className="mt-3 text-caption text-error">{claimError}</p>
                  )}
                </div>
              )}
            </Card>
          )}

          {isExam && testReview && (
            <div className="space-y-4">
              <h2 className="text-h2 text-text-primary">{isMock ? "Mock test review" : "Exam review"}</h2>
              {testReview.results.map((item, index) => {
                const domainColor = getDomainColor(item.domain?.name);
                return (
                  <Card
                    key={item.question_id}
                    className={cn(
                      "p-5",
                      item.skipped && "border-l-4 border-l-warning bg-warning-muted/20"
                    )}
                  >
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className={cn("inline-block rounded-full px-3 py-1 text-caption font-medium", domainColor.bg, domainColor.text)}>
                        {item.domain?.name}
                      </span>
                      <span className="flex items-center gap-2">
                        {item.skipped && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-warning-muted px-2.5 py-1 text-caption font-semibold text-warning">
                            <CircleSlash className="h-3 w-3" aria-hidden="true" />
                            Skipped
                          </span>
                        )}
                        <span className="text-caption font-medium uppercase tracking-wide text-text-muted">
                          Question {index + 1}
                        </span>
                      </span>
                    </div>
                    <p className="mb-2 text-body-sm font-medium text-text-primary">{item.text}</p>
                    {item.image && (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={item.image}
                        alt=""
                        className="mb-2 max-h-64 rounded-md border border-border object-contain"
                      />
                    )}
                    <p className="mb-1 text-body-sm text-text-secondary">
                      Your answer:{" "}
                      <span className={cn("font-medium", item.skipped ? "text-warning" : "text-text-primary")}>
                        {describeYourAnswer(item)}
                      </span>
                    </p>
                    {item.confidence != null && (
                      <p className="mb-3 text-body-sm text-text-secondary">
                        Your confidence:{" "}
                        <span className="font-medium text-text-primary">
                          {item.confidence} — {item.confidence_label}
                        </span>
                      </p>
                    )}

                    {item.high_confidence_mistake && (
                      <div className="mb-3 flex items-start gap-2 rounded-md border border-warning/30 bg-warning-muted p-3 text-body-sm text-text-secondary">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
                        <span>
                          <span className="font-semibold text-text-primary">High-confidence mistake.</span> You were
                          very confident in this answer, but it was incorrect. Review the explanation below to
                          strengthen your understanding.
                        </span>
                      </div>
                    )}
                    {item.low_confidence_correct && (
                      <div className="mb-3 flex items-start gap-2 rounded-md border border-border bg-surface-muted p-3 text-body-sm text-text-secondary">
                        <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                        <span>
                          <span className="font-semibold text-text-primary">Correct, but you weren&apos;t sure.</span>{" "}
                          Revisit this concept to turn a lucky guess into solid knowledge.
                        </span>
                      </div>
                    )}

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
  const unansweredCount = totalCount - answeredCount;
  const isLastPage = currentPage >= pageCount - 1;

  return (
    <div className="min-h-[calc(100vh-57px)] sm:min-h-screen bg-background px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-2xl">
        {isExamLike ? (
          <div className="mb-4 rounded-xl border border-test/20 bg-test-muted/40 p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface text-test shadow-xs">
                  {isMock ? (
                    <GraduationCap className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <ClipboardCheck className="h-4 w-4" aria-hidden="true" />
                  )}
                </span>
                <div>
                  <p className="text-caption font-semibold uppercase tracking-wide text-test">
                    {isMock ? "ISTQB Mock Test" : "Real Exam"}
                  </p>
                  <p className="text-body-sm font-medium text-text-primary">
                    Question {pageStart + 1}–{Math.min(pageStart + PER_PAGE, questions.length)} of {totalCount}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-surface px-2.5 py-1 text-caption font-semibold tabular-nums text-text-secondary shadow-xs">
                  <Check className="h-3 w-3 text-test" aria-hidden="true" />
                  {answeredCount}/{totalCount}
                </span>
                {unansweredCount > 0 && (
                  <span className="inline-flex items-center rounded-full bg-warning-muted px-2.5 py-1 text-caption font-semibold tabular-nums text-warning">
                    {unansweredCount} left
                  </span>
                )}
                <Button tone="test" size="sm" onClick={requestFinish}>
                  {isMock ? "Submit" : "Submit exam"}
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="mb-2 flex items-center justify-between text-body-sm text-text-muted">
            <span>
              Questions {pageStart + 1}–{Math.min(pageStart + PER_PAGE, questions.length)} of {totalCount}
              <span className="ml-2 text-text-muted/70">· {answeredCount} answered</span>
            </span>
            <div className="flex items-center gap-2">
              <Badge tone="test">Score: {correctCount}</Badge>
              <button
                type="button"
                onClick={() => setShowEndConfirm(true)}
                className="cursor-pointer rounded-full border border-border px-2.5 py-0.5 text-caption font-medium text-text-muted transition-colors hover:border-error/30 hover:bg-error-muted hover:text-error"
              >
                End practice
              </button>
            </div>
          </div>
        )}

        <Progress value={progressPercent} tone="test" className="mb-4" />

        {isExamLike && skipNoticeOpen && unansweredCount > 0 && (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-warning/30 bg-warning-muted/60 p-4 animate-fade-in">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface text-warning shadow-xs">
              <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <p className="text-body-sm font-semibold text-text-primary">
                  {unansweredCount} question{unansweredCount === 1 ? "" : "s"} still unanswered
                </p>
                <button
                  type="button"
                  onClick={() => setSkipNoticeOpen(false)}
                  aria-label="Dismiss"
                  className="-mr-1 -mt-1 shrink-0 cursor-pointer rounded-md p-1 text-text-muted transition-colors hover:bg-warning-muted hover:text-text-secondary"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
              <p className="mt-0.5 text-caption text-text-secondary">
                Answer {unansweredCount === 1 ? "it" : "them"} below, or press{" "}
                <span className="font-medium text-text-primary">
                  {isMock ? "Submit mock test" : "Submit exam"}
                </span>{" "}
                again to finish with {unansweredCount === 1 ? "it" : "them"} marked incorrect.
              </p>
              <Button
                tone="test"
                size="sm"
                className="mt-2.5"
                onClick={() => {
                  const idx = firstUnansweredIndex();
                  if (idx !== -1) goToQuestion(idx);
                }}
              >
                Go to unanswered
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Button>
            </div>
          </div>
        )}

        {/* Question navigator: jump to any question. */}
        <div className="mb-6">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-caption font-semibold uppercase tracking-wide text-text-muted">
              Questions
            </p>
            <div className="flex items-center gap-3 text-caption text-text-muted">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-test" aria-hidden="true" />
                Answered
              </span>
              <span className="flex items-center gap-1.5">
                <span
                  className={cn(
                    "h-2.5 w-2.5 rounded-sm border",
                    isExamLike && skipsAcknowledged
                      ? "border-warning/60 bg-warning-muted"
                      : "border-border-strong bg-surface"
                  )}
                  aria-hidden="true"
                />
                {isExamLike && skipsAcknowledged ? "Skipped" : "Unanswered"}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {questions.map((q, index) => {
              const onThisPage = index >= pageStart && index < pageStart + PER_PAGE;
              const submitted = submittedIds.has(q.id);
              return (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => goToQuestion(index)}
                  aria-current={onThisPage ? "true" : undefined}
                  aria-label={`Question ${index + 1}${submitted ? " (answered)" : " (not answered)"}`}
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-md border text-caption font-semibold tabular-nums transition-all",
                    submitted
                      ? "border-test bg-test text-white"
                      : isExamLike && skipsAcknowledged
                        ? "border-warning/60 bg-warning-muted text-warning hover:border-warning"
                        : "border-border bg-surface text-text-muted hover:border-test/40 hover:text-text-secondary",
                    onThisPage && "ring-2 ring-test/40 ring-offset-1"
                  )}
                >
                  {index + 1}
                </button>
              );
            })}
          </div>
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
                onEdit={isExamLike ? () => handleEditAnswer(question.id) : undefined}
                canSkip={false}
                isAnswered={submitted}
                isSubmitting={submittingId === question.id}
                result={result}
                mode={mode}
                hideAdvance
                confidenceRequired={mode === "test"}
                confidence={confidenceById[question.id] ?? null}
                onConfidenceChange={(level) => handleConfidenceChange(question.id, level)}
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
              {isMock ? "Submit mock test" : mode === "test" ? "Submit exam" : "Finish session"}
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
          isExamLike
            ? `Submit your ${isMock ? "mock test" : "exam"}?`
            : allAnswered
              ? "Finish this session?"
              : `${totalCount - answeredCount} question${totalCount - answeredCount === 1 ? "" : "s"} still unanswered`
        }
        message={
          isExamLike
            ? `You can't change your answers after this. You'll get your score and a full review.${
                answeredCount < totalCount
                  ? ` ${totalCount - answeredCount} unanswered question${
                      totalCount - answeredCount === 1 ? "" : "s"
                    } will be marked incorrect.`
                  : ""
              }`
            : "Your progress so far will be saved, but you won't be able to resume these remaining questions."
        }
        confirmLabel={isExamLike ? `Submit ${isMock ? "mock test" : "exam"}` : "End session"}
        cancelLabel={isExamLike ? "Keep working" : "Keep practicing"}
        onConfirm={endSession}
        onCancel={() => {
          setShowEndConfirm(false);
          // Make a later Submit press walk them back through any skipped
          // questions again rather than reopening this dialog straight away.
          setSkipsAcknowledged(false);
        }}
      />
    </div>
  );
}
