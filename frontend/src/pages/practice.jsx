import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { useAuth } from "../context/AuthContext";
import { fetchPracticeQuestions, submitAnswer } from "../services/questionsService";
import QuestionCard from "../components/QuestionCard";
import FeedbackPanel from "../components/FeedbackPanel";

export default function PracticePage() {
  const router = useRouter();
  const { user, isLoading: isAuthLoading } = useAuth();

  const [questions, setQuestions] = useState([]);
  const [sessionId, setSessionId] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOptionId, setSelectedOptionId] = useState(null);
  const [result, setResult] = useState(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [isSessionComplete, setIsSessionComplete] = useState(false);

  useEffect(() => {
    if (!isAuthLoading && !user) {
      router.replace("/login");
    }
  }, [isAuthLoading, user, router]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const data = await fetchPracticeQuestions(10);
        setQuestions(data.questions);
        setSessionId(data.session_id);
      } catch {
        setLoadError("Couldn't load practice questions. Please try again.");
      } finally {
        setIsLoadingQuestions(false);
      }
    })();
  }, [user]);

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

  if (isAuthLoading || !user) return null;

  if (isLoadingQuestions) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        Loading questions…
      </div>
    );
  }

  if (loadError && questions.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center text-red-600">
        {loadError}
      </div>
    );
  }

  if (isSessionComplete) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-sm bg-white rounded-xl shadow p-8 text-center">
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">Session complete</h1>
          <p className="text-gray-600 mb-6">
            You scored {correctCount} / {questions.length}
          </p>
          <button
            type="button"
            onClick={() => router.reload()}
            className="w-full rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500"
          >
            Start another session
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <div className="mb-4 flex items-center justify-between text-sm text-gray-500">
          <span>
            Question {currentIndex + 1} of {questions.length}
          </span>
          <span>Score: {correctCount}</span>
        </div>

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

        {loadError && <p className="mt-4 text-sm text-red-600">{loadError}</p>}
      </div>
    </div>
  );
}
