import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { useAuth } from "../context/AuthContext";
import { fetchDomains, fetchPracticeQuestions, submitAnswer } from "../services/questionsService";
import { getDomainColor } from "../utils/domainColors";
import QuestionCard from "../components/QuestionCard";
import FeedbackPanel from "../components/FeedbackPanel";

const SESSION_SIZE = 10;

export default function PracticePage() {
  const router = useRouter();
  const { user, isLoading: isAuthLoading } = useAuth();

  const [domains, setDomains] = useState([]);
  const [isSettingUp, setIsSettingUp] = useState(true);
  const [selectedDomainId, setSelectedDomainId] = useState(null); // null = all domains mixed

  const [questions, setQuestions] = useState([]);
  const [sessionId, setSessionId] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOptionId, setSelectedOptionId] = useState(null);
  const [result, setResult] = useState(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [isSessionComplete, setIsSessionComplete] = useState(false);

  useEffect(() => {
    if (!isAuthLoading && !user) {
      router.replace("/login");
    }
  }, [isAuthLoading, user, router]);

  useEffect(() => {
    if (!user) return;
    fetchDomains()
      .then(setDomains)
      .catch(() => {});
  }, [user]);

  async function startSession(domainId) {
    setSelectedDomainId(domainId);
    setLoadError("");
    setIsLoadingQuestions(true);
    try {
      const data = await fetchPracticeQuestions(SESSION_SIZE, domainId);
      setQuestions(data.questions);
      setSessionId(data.session_id);
      setCurrentIndex(0);
      setSelectedOptionId(null);
      setResult(null);
      setCorrectCount(0);
      setIsSessionComplete(false);
      setIsSettingUp(false);
    } catch {
      setLoadError("Couldn't load practice questions for that domain. Please try again.");
    } finally {
      setIsLoadingQuestions(false);
    }
  }

  function backToSetup() {
    setIsSettingUp(true);
    setQuestions([]);
    setIsSessionComplete(false);
    setLoadError("");
  }

  const currentQuestion = questions[currentIndex];
  const isLastQuestion = currentIndex === questions.length - 1;
  const activeDomainLabel = selectedDomainId
    ? (domains.find((d) => d.id === selectedDomainId)?.name ?? "Domain")
    : "All Domains";

  function handleSelectOption(optionId) {
    if (result) return;
    setSelectedOptionId(optionId);
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
    if (isLastQuestion) {
      setIsSessionComplete(true);
      return;
    }
    setCurrentIndex((i) => i + 1);
    setSelectedOptionId(null);
    setResult(null);
    setLoadError("");
  }

  if (isAuthLoading || !user) return null;

  if (isSettingUp) {
    return (
      <div className="min-h-[calc(100vh-49px)] bg-gray-50 px-4 py-10">
        <div className="mx-auto max-w-3xl">
          <h1 className="text-2xl font-bold text-gray-900">Choose what to practice</h1>
          <p className="mt-1 text-sm text-gray-500">
            Practice a single domain, or mix questions from all 6 CTFL domains in one session.
          </p>

          {loadError && <p className="mt-4 text-sm text-red-600">{loadError}</p>}

          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button
              type="button"
              disabled={isLoadingQuestions}
              onClick={() => startSession(null)}
              className="rounded-xl border-2 border-indigo-200 bg-indigo-50 p-5 text-left transition-all hover:border-indigo-400 hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
            >
              <p className="text-base font-semibold text-indigo-900">All Domains</p>
              <p className="mt-1 text-sm text-indigo-700">Mixed questions from every domain.</p>
            </button>

            {domains.map((domain) => {
              const color = getDomainColor(domain.name);
              return (
                <button
                  key={domain.id}
                  type="button"
                  disabled={isLoadingQuestions}
                  onClick={() => startSession(domain.id)}
                  className={`rounded-xl border-2 border-transparent p-5 text-left transition-all hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-50 ${color.bg}`}
                >
                  <p className={`text-base font-semibold ${color.text}`}>{domain.name}</p>
                  <p className="mt-1 text-sm text-gray-500">Questions from this domain only.</p>
                </button>
              );
            })}
          </div>

          {isLoadingQuestions && <p className="mt-6 text-sm text-gray-500">Loading questions…</p>}
        </div>
      </div>
    );
  }

  if (isLoadingQuestions) {
    return (
      <div className="min-h-[calc(100vh-49px)] flex items-center justify-center text-gray-500">
        Loading questions…
      </div>
    );
  }

  if (loadError && questions.length === 0) {
    return (
      <div className="min-h-[calc(100vh-49px)] flex items-center justify-center text-red-600">
        {loadError}
      </div>
    );
  }

  if (isSessionComplete) {
    const scorePercent = Math.round((correctCount / questions.length) * 100);
    return (
      <div className="min-h-[calc(100vh-49px)] flex items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-sm bg-white rounded-xl shadow p-8 text-center animate-pop">
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">Session complete</h1>
          <p
            className={`text-3xl font-semibold mb-1 ${
              scorePercent >= 70 ? "text-green-600" : scorePercent >= 40 ? "text-yellow-600" : "text-red-600"
            }`}
          >
            {correctCount} / {questions.length}
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

  const progressPercent = ((currentIndex + (result ? 1 : 0)) / questions.length) * 100;

  return (
    <div className="min-h-[calc(100vh-49px)] bg-gray-50 px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <div className="mb-2 flex items-center justify-between text-sm text-gray-500">
          <span>
            <span className="mr-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium uppercase tracking-wide text-gray-500">
              {activeDomainLabel}
            </span>
            Question {currentIndex + 1} of {questions.length}
          </span>
          <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 font-medium text-indigo-700">
            Score: {correctCount}
          </span>
        </div>

        <div className="mb-6 h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
          <div
            className="h-full rounded-full bg-indigo-500 transition-all duration-300 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        <div key={currentIndex} className="animate-fade-in">
          <QuestionCard
            question={currentQuestion}
            selectedOptionId={selectedOptionId}
            onSelectOption={handleSelectOption}
            onSubmit={handleSubmit}
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
    </div>
  );
}
