import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { useAuth } from "../context/AuthContext";
import { fetchDomains, fetchPracticeQuestions, finishSession, submitAnswer } from "../services/questionsService";
import QuestionCard from "../components/QuestionCard";
import FeedbackPanel from "../components/FeedbackPanel";
import ConfirmModal from "../components/ConfirmModal";

const DOMAIN_ICONS = ["🧩", "🔄", "🔍", "🧠", "🗂️", "🛠️"];

const SESSION_LENGTHS = [
  { value: 10, label: "Quick", minutes: "~10 min" },
  { value: 20, label: "Standard", minutes: "~20 min" },
  { value: 40, label: "Deep dive", minutes: "~40 min" },
];

export default function PracticePage() {
  const router = useRouter();
  const { user, isLoading: isAuthLoading } = useAuth();
  const { setIsActive: setSessionLocked } = usePracticeSession();

  const [domains, setDomains] = useState([]);
  const [sessionStarted, setSessionStarted] = useState(false);
  const [selectedDomainIds, setSelectedDomainIds] = useState([]);
  const [sessionLength, setSessionLength] = useState(10);

  // `queue` holds the questions still owed an answer, in the order they'll be
  // shown. Skipping a question moves it from the front to the back instead
  // of removing it, so it comes back around later in the same session.
  const [queue, setQueue] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [skippedIds, setSkippedIds] = useState(() => new Set());
  const [sessionId, setSessionId] = useState(null);
  const [selectedOptionId, setSelectedOptionId] = useState(null);
  const [result, setResult] = useState(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [isSessionComplete, setIsSessionComplete] = useState(false);
  const [showEndConfirm, setShowEndConfirm] = useState(false);

  // Domains are public, so even guests browsing before login see real names.
  useEffect(() => {
    fetchDomains()
      .then(setDomains)
      .catch(() => {});
  }, []);

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
      const data = await fetchPracticeQuestions(sessionLength, selectedDomainIds);
      setQueue(data.questions);
      setTotalCount(data.questions.length);
      setSkippedIds(new Set());
      setSessionId(data.session_id);
      setSelectedOptionId(null);
      setResult(null);
      setCorrectCount(0);
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
    setQueue([]);
    setIsSessionComplete(false);
    setLoadError("");
  }

  const currentQuestion = queue[0];
  const isLastQuestion = queue.length === 1;
  const currentPosition = totalCount - queue.length + 1;

  function handleSelectOption(optionId) {
    if (result) return;
    setSelectedOptionId(optionId);
    setLoadError("");
  }

  function handleSkip() {
    if (result || queue.length <= 1) return;
    setQueue((q) => [...q.slice(1), q[0]]);
    setSkippedIds((s) => new Set(s).add(currentQuestion.id));
    setSelectedOptionId(null);
    setLoadError("");
  }

  async function handleSubmit() {
    if (!selectedOptionId || result || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const data = await submitAnswer({
        sessionId,
        questionId: currentQuestion.id,
        optionId: selectedOptionId,
      });
      setResult({
        isCorrect: data.is_correct,
        correctOptionId: data.correct_option_id,
        correctOptionText: data.correct_option_text,
      });
      if (data.is_correct) setCorrectCount((c) => c + 1);
    } catch {
      setLoadError("Couldn't submit your answer. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleNext() {
    const remaining = queue.length - 1;
    setSkippedIds((s) => {
      if (!s.has(currentQuestion.id)) return s;
      const next = new Set(s);
      next.delete(currentQuestion.id);
      return next;
    });
    setQueue((q) => q.slice(1));
    if (remaining <= 0) {
      // Best-effort: the session summary below is computed from local state
      // regardless, so a failed finish call shouldn't block the user here --
      // it just means this session won't show as "Completed" on analytics.
      finishSession(sessionId).catch(() => {});
      setIsSessionComplete(true);
      return;
    }
    setSelectedOptionId(null);
    setResult(null);
    setLoadError("");
  }

  async function handleEndPractice() {
    setShowEndConfirm(false);
    try {
      await finishSession(sessionId);
    } catch {
      // Best-effort -- the session still ends locally even if this fails.
    }
    setIsSessionComplete(true);
  }

  if (isAuthLoading) return null;

  if (!sessionStarted) {
    return (
      <div className="min-h-[calc(100vh-49px)] bg-gray-50 px-4 py-10">
        <div className="mx-auto max-w-2xl space-y-8">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Start a practice session</h1>
            {!user && (
              <p className="mt-1 text-sm text-gray-500">
                Browse the options below freely — you&apos;ll only need an account once you&apos;re ready to
                answer questions.
              </p>
            )}
          </div>

          {!user && (
            <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-5">
              <h2 className="text-sm font-semibold text-indigo-900">What&apos;s in a practice session?</h2>
              <ul className="mt-3 space-y-2 text-sm text-indigo-800 list-disc list-inside">
                <li>Real exam-style multiple choice questions across all 6 CTFL v4.0 knowledge domains.</li>
                <li>Instant feedback on every answer — see the correct option highlighted right away.</li>
                <li>
                  AI-generated explanations for why an answer is right or wrong, tied back to the specific
                  concept being tested.
                </li>
                <li>
                  Every attempt feeds your analytics dashboard, so you can see exactly which domains need
                  more work.
                </li>
              </ul>
            </div>
          )}

          {loadError && <p className="text-sm text-red-600 animate-fade-in">{loadError}</p>}

          <div>
            <h2 className="mb-1 text-sm font-medium text-gray-700">Filter by domain</h2>
            <p className="mb-3 text-xs text-gray-400">Optional — leave all unselected to practice every domain.</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {domains.map((domain, index) => {
                const isSelected = selectedDomainIds.includes(domain.id);
                return (
                  <button
                    key={domain.id}
                    type="button"
                    onClick={() => toggleDomain(domain.id)}
                    aria-pressed={isSelected}
                    className={`group flex items-center gap-3 rounded-xl border-2 p-4 text-left transition-all active:scale-[0.98] ${
                      isSelected
                        ? "border-indigo-600 bg-indigo-50 shadow-sm"
                        : "border-gray-200 bg-white hover:border-indigo-200 hover:bg-indigo-50/40"
                    }`}
                  >
                    <span
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg transition-transform group-hover:scale-110 ${
                        isSelected ? "bg-indigo-600" : "bg-gray-100"
                      }`}
                    >
                      {DOMAIN_ICONS[index % DOMAIN_ICONS.length]}
                    </span>
                    <span className="min-w-0">
                      <span
                        className={`block truncate text-sm font-semibold ${
                          isSelected ? "text-indigo-900" : "text-gray-900"
                        }`}
                      >
                        {domain.name}
                      </span>
                    </span>
                    {isSelected && (
                      <span className="ml-auto flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xs text-white">
                        ✓
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <h2 className="mb-3 text-sm font-medium text-gray-700">Session length</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {SESSION_LENGTHS.map((option) => {
                const isSelected = sessionLength === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setSessionLength(option.value)}
                    aria-pressed={isSelected}
                    className={`rounded-xl border-2 p-4 text-center transition-all active:scale-[0.98] ${
                      isSelected
                        ? "border-indigo-600 bg-indigo-50 shadow-sm"
                        : "border-gray-200 bg-white hover:border-indigo-200 hover:bg-indigo-50/40"
                    }`}
                  >
                    <span
                      className={`text-2xl font-bold tabular-nums ${
                        isSelected ? "text-indigo-700" : "text-gray-900"
                      }`}
                    >
                      {option.value}
                    </span>
                    <span className="mt-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                      {option.label}
                    </span>
                    <span className="mt-0.5 block text-xs text-gray-400">{option.minutes}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-gray-100 px-5 py-4 text-sm">
            <div className="flex items-center gap-2 text-gray-700">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-base shadow-sm">
                📝
              </span>
              <span>
                <span className="font-semibold text-gray-900">{sessionLength} questions</span> from{" "}
                <span className="font-semibold text-gray-900">
                  {selectedDomainIds.length === 0
                    ? "all domains"
                    : `${selectedDomainIds.length} domain${selectedDomainIds.length > 1 ? "s" : ""}`}
                </span>
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={startSession}
            disabled={isLoadingQuestions}
            className="w-full rounded-md bg-indigo-600 py-3 text-sm font-semibold text-white transition-all hover:bg-indigo-500 active:scale-[0.98] disabled:opacity-50"
          >
            {isLoadingQuestions ? "Loading questions…" : user ? "Start session" : "Log in to start"}
          </button>
        </div>
      </div>
    );
  }

  if (isSessionComplete) {
    const scorePercent = Math.round((correctCount / totalCount) * 100);
    return (
      <div className="min-h-[calc(100vh-49px)] flex items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-sm bg-white rounded-xl shadow p-8 text-center animate-pop">
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">Session complete</h1>
          <p
            className={`text-3xl font-semibold mb-1 ${
              scorePercent >= 70 ? "text-green-600" : scorePercent >= 40 ? "text-yellow-600" : "text-red-600"
            }`}
          >
            {correctCount} / {totalCount}
          </p>
          <p className="text-gray-500 mb-6">{scorePercent}% correct</p>
          <button
            type="button"
            onClick={backToSetup}
            className="w-full rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white transition-all hover:bg-indigo-500 active:scale-[0.98]"
          >
            Start another session
          </button>
        </div>
      </div>
    );
  }

  const progressPercent = totalCount ? ((currentPosition - 1 + (result ? 1 : 0)) / totalCount) * 100 : 0;

  return (
    <div className="min-h-[calc(100vh-49px)] bg-gray-50 px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <div className="mb-2 flex items-center justify-between text-sm text-gray-500">
          <span>
            Question {currentPosition} of {totalCount}
          </span>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 font-medium text-indigo-700">
              Score: {correctCount}
            </span>
            <button
              type="button"
              onClick={() => setShowEndConfirm(true)}
              className="rounded-full border border-gray-200 px-2.5 py-0.5 text-xs font-medium text-gray-500 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600 active:scale-95"
            >
              End practice
            </button>
          </div>
        </div>

        <div className="mb-6 h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
          <div
            className="h-full rounded-full bg-indigo-500 transition-all duration-300 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {skippedIds.size > 0 && (
          <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 animate-fade-in">
            {skippedIds.size} question{skippedIds.size === 1 ? "" : "s"} skipped — you&apos;ll get{" "}
            {skippedIds.size === 1 ? "it" : "them"} again before this session ends.
          </p>
        )}

        <div key={currentQuestion?.id} className="animate-fade-in">
          <QuestionCard
            question={currentQuestion}
            selectedOptionId={selectedOptionId}
            onSelectOption={handleSelectOption}
            onSubmit={handleSubmit}
            onSkip={handleSkip}
            canSkip={queue.length > 1}
            isAnswered={Boolean(result)}
            isSubmitting={isSubmitting}
            correctOptionId={result?.correctOptionId}
          />

          {result && (
            <FeedbackPanel
              isCorrect={result.isCorrect}
              correctOptionText={result.correctOptionText}
              questionId={currentQuestion.id}
              onNext={handleNext}
              isLastQuestion={isLastQuestion}
            />
          )}
        </div>

        {loadError && <p className="mt-4 text-sm text-red-600 animate-fade-in">{loadError}</p>}
      </div>

      <ConfirmModal
        open={showEndConfirm}
        title="Do you want to end the practice session?"
        message="Your progress so far will be saved, but you won't be able to resume these remaining questions."
        confirmLabel="End session"
        cancelLabel="Keep practicing"
        onConfirm={handleEndPractice}
        onCancel={() => setShowEndConfirm(false)}
      />
    </div>
  );
}
