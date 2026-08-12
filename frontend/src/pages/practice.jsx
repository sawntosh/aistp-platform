import { useState } from "react";
import { useRouter } from "next/router";
import { useAuth } from "../context/AuthContext";
import { fetchPracticeQuestions, submitAnswer } from "../services/questionsService";
import QuestionCard from "../components/QuestionCard";
import FeedbackPanel from "../components/FeedbackPanel";

const DOMAINS = [
  { name: "Fundamentals of Testing", icon: "🧩", blurb: "Core testing principles" },
  { name: "Testing Throughout the SDLC", icon: "🔄", blurb: "Testing across the lifecycle" },
  { name: "Static Testing", icon: "🔍", blurb: "Reviews without execution" },
  { name: "Test Analysis and Design", icon: "🧠", blurb: "Designing test cases" },
  { name: "Managing the Test Activities", icon: "🗂️", blurb: "Planning & control" },
  { name: "Test Tools", icon: "🛠️", blurb: "Tooling & automation" },
];

const SESSION_LENGTHS = [
  { value: 10, label: "Quick", minutes: "~10 min" },
  { value: 20, label: "Standard", minutes: "~20 min" },
  { value: 40, label: "Deep dive", minutes: "~40 min" },
];

export default function PracticePage() {
  const router = useRouter();
  const { user, isLoading: isAuthLoading } = useAuth();

  const [sessionStarted, setSessionStarted] = useState(false);
  const [selectedDomains, setSelectedDomains] = useState([]);
  const [sessionLength, setSessionLength] = useState(10);

  const [questions, setQuestions] = useState([]);
  const [sessionId, setSessionId] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOptionId, setSelectedOptionId] = useState(null);
  const [result, setResult] = useState(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [isSessionComplete, setIsSessionComplete] = useState(false);

  function toggleDomain(domainName) {
    setSelectedDomains((prev) =>
      prev.includes(domainName) ? prev.filter((d) => d !== domainName) : [...prev, domainName]
    );
  }

  async function startSession() {
    // Only gate here -- guests can browse the setup screen freely,
    // but need an account to actually start practicing.
    if (!user) {
      router.push("/login");
      return;
    }

    setIsLoadingQuestions(true);
    setLoadError("");
    try {
      const data = await fetchPracticeQuestions(sessionLength, selectedDomains);
      setQuestions(data.questions);
      setSessionId(data.session_id);
      setCurrentIndex(0);
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

  const currentQuestion = questions[currentIndex];
  const isLastQuestion = currentIndex === questions.length - 1;

  async function handleSelectOption(optionId) {
    if (result) return;
    setSelectedOptionId(optionId);
    try {
      const data = await submitAnswer({
        sessionId,
        questionId: currentQuestion.id,
        optionId,
      });
      setResult({
        isCorrect: data.is_correct,
        correctOptionId: data.correct_option_id,
        correctOptionText: data.correct_option_text,
      });
      if (data.is_correct) setCorrectCount((c) => c + 1);
    } catch {
      setLoadError("Couldn't submit your answer. Please try again.");
      setSelectedOptionId(null);
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
                Browse the options below freely — you'll only need an account once
                you're ready to answer questions.
              </p>
            )}
          </div>

          {!user && (
            <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-5">
              <h2 className="text-sm font-semibold text-indigo-900">
                What's in a practice session?
              </h2>
              <ul className="mt-3 space-y-2 text-sm text-indigo-800 list-disc list-inside">
                <li>
                  Real exam-style multiple choice questions across all 6 CTFL v4.0
                  knowledge domains.
                </li>
                <li>
                  Instant feedback on every answer — see the correct option
                  highlighted right away.
                </li>
                <li>
                  AI-generated explanations for why an answer is right or wrong,
                  tied back to the specific concept being tested.
                </li>
                <li>
                  Every attempt feeds your analytics dashboard, so you can see
                  exactly which domains need more work.
                </li>
              </ul>
            </div>
          )}

          {loadError && <p className="text-sm text-red-600 animate-fade-in">{loadError}</p>}

          <div>
            <h2 className="mb-1 text-sm font-medium text-gray-700">
              Filter by domain
            </h2>
            <p className="mb-3 text-xs text-gray-400">
              Optional — leave all unselected to practice every domain.
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {DOMAINS.map((domain) => {
                const isSelected = selectedDomains.includes(domain.name);
                return (
                  <button
                    key={domain.name}
                    type="button"
                    onClick={() => toggleDomain(domain.name)}
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
                      {domain.icon}
                    </span>
                    <span className="min-w-0">
                      <span
                        className={`block truncate text-sm font-semibold ${
                          isSelected ? "text-indigo-900" : "text-gray-900"
                        }`}
                      >
                        {domain.name}
                      </span>
                      <span className="block truncate text-xs text-gray-500">
                        {domain.blurb}
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
                    <span className="mt-0.5 block text-xs text-gray-400">
                      {option.minutes}
                    </span>
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
                <span className="font-semibold text-gray-900">{sessionLength} questions</span>{" "}
                from{" "}
                <span className="font-semibold text-gray-900">
                  {selectedDomains.length === 0 ? "all domains" : `${selectedDomains.length} domain${selectedDomains.length > 1 ? "s" : ""}`}
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
            {isLoadingQuestions
              ? "Loading questions…"
              : user
              ? "Start session"
              : "Log in to start"}
          </button>
        </div>
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
            onClick={() => setSessionStarted(false)}
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
            isAnswered={Boolean(result)}
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