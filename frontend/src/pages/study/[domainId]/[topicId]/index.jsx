import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { useAuth } from "../../../../context/AuthContext";
import {
  completeStudySession,
  fetchStudyTopics,
  startStudyTopic,
  submitStudyAnswer,
} from "../../../../services/studyService";
import StudySidebar from "../../../../components/StudySidebar";
import StudyContentReader from "../../../../components/StudyContentReader";
import StudyTransition from "../../../../components/StudyTransition";
import StudyQuestion from "../../../../components/StudyQuestion";
import StudyAnswerFeedback from "../../../../components/StudyAnswerFeedback";
import StudyCompletion from "../../../../components/StudyCompletion";
import ConfirmModal from "../../../../components/ConfirmModal";
import { RichText } from "../../../../utils/richText";

// Builds the study-answer payload shape for the current question's type
// -- same four shapes questionsService.submitAnswer uses.
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

function describeCorrectAnswer(question, data) {
  switch (question.question_type) {
    case "multi_select":
      return (data.correct_option_texts ?? []).join(", ");
    case "fill_blank":
      return data.correct_answer ?? "";
    case "matching":
      return question.matching_pairs.map((pair) => `${pair.prompt_text} → ${data.correct_pairing?.[pair.id]}`).join("; ");
    default: // mcq / true_false
      return data.correct_option_text ?? "";
  }
}

export default function StudyTopicPage() {
  const router = useRouter();
  const { domainId, topicId } = router.query;
  const { user, isLoading: isAuthLoading } = useAuth();

  const [pageState, setPageState] = useState("loading"); // loading | error | ready
  const [sidebarData, setSidebarData] = useState(null); // { domain, topics }
  const [start, setStart] = useState(null); // { session_id, topic, content, questions }

  const [stage, setStage] = useState("reading"); // reading | transition | questions | complete
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answer, setAnswer] = useState(null);
  const [result, setResult] = useState(null);
  const [isChecking, setIsChecking] = useState(false);
  const [answerError, setAnswerError] = useState("");
  const [reviewOpen, setReviewOpen] = useState(false);
  const [pendingTopicSwitch, setPendingTopicSwitch] = useState(null);
  const [completion, setCompletion] = useState(null);

  useEffect(() => {
    if (!isAuthLoading && !user) {
      router.replace("/login");
    }
  }, [isAuthLoading, user, router]);

  async function loadTopic() {
    setPageState("loading");
    setStage("reading");
    setCurrentIndex(0);
    setAnswer(null);
    setResult(null);
    setCompletion(null);
    try {
      const [sidebar, startData] = await Promise.all([fetchStudyTopics(domainId), startStudyTopic(topicId)]);
      setSidebarData(sidebar);
      setStart(startData);
      setPageState("ready");
    } catch {
      setPageState("error");
    }
  }

  useEffect(() => {
    if (user && domainId && topicId) loadTopic();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, domainId, topicId]);

  if (isAuthLoading || !user) return null;

  function goToTopic(nextTopicId) {
    if (stage === "questions" && String(nextTopicId) !== String(topicId)) {
      setPendingTopicSwitch(nextTopicId);
      return;
    }
    router.push(`/study/${domainId}/${nextTopicId}`);
  }

  const currentQuestion = start?.questions?.[currentIndex];
  const totalQuestions = start?.questions?.length ?? 0;
  const isLastQuestion = currentIndex === totalQuestions - 1;

  async function handleCheckAnswer() {
    if (result || isChecking) return;
    setIsChecking(true);
    setAnswerError("");
    try {
      const data = await submitStudyAnswer(start.session_id, currentQuestion.id, buildAnswerPayload(currentQuestion, answer));
      setResult({
        isCorrect: data.is_correct,
        correctOptionId: data.correct_option_id,
        correctOptionIds: data.correct_option_ids,
        correctAnswer: data.correct_answer,
        correctPairing: data.correct_pairing,
        correctAnswerText: describeCorrectAnswer(currentQuestion, data),
      });
    } catch {
      setAnswerError("Couldn't check your answer right now. Please try again.");
    } finally {
      setIsChecking(false);
    }
  }

  async function handleNextQuestion() {
    if (isLastQuestion) {
      try {
        const data = await completeStudySession(start.session_id);
        setCompletion(data);
      } catch {
        setCompletion({ questions_answered: currentIndex + 1, next_topic: null });
      }
      setStage("complete");
      return;
    }
    setCurrentIndex((i) => i + 1);
    setAnswer(null);
    setResult(null);
    setAnswerError("");
  }

  async function handleFinishWithoutQuestions() {
    try {
      const data = await completeStudySession(start.session_id);
      setCompletion(data);
    } catch {
      setCompletion({ questions_answered: 0, next_topic: null });
    }
    setStage("complete");
  }

  return (
    <div className="min-h-[calc(100vh-49px)] bg-gray-50 px-4 py-8">
      <div className="mx-auto max-w-5xl">
        <Link href={`/study/${domainId}`} className="text-sm font-medium text-gray-500 hover:text-gray-900">
          ← {sidebarData?.domain?.name ?? "Study"}
        </Link>
        <span className="ml-3 text-xs font-semibold uppercase tracking-wide text-indigo-500">📖 Study Mode</span>

        {pageState === "loading" && (
          <div className="mt-8 space-y-4" aria-busy="true" aria-label="Loading study content">
            <div className="h-6 w-1/3 animate-pulse rounded bg-gray-200" />
            <div className="h-4 w-2/3 animate-pulse rounded bg-gray-200" />
            <div className="h-40 animate-pulse rounded-xl bg-gray-100" />
          </div>
        )}

        {pageState === "error" && (
          <div className="mt-8 rounded-xl border border-red-200 bg-red-50 p-6 text-center">
            <p className="text-sm text-red-700">Something went wrong loading this topic.</p>
            <div className="mt-3 flex justify-center gap-3">
              <button
                type="button"
                onClick={loadTopic}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 active:scale-[0.98]"
              >
                Try Again
              </button>
              <Link
                href="/study"
                className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Back to Study
              </Link>
            </div>
          </div>
        )}

        {pageState === "ready" && start && (
          <div className="mt-6 flex flex-col gap-8 md:flex-row">
            <h1 className="sr-only">Study: {start.topic.title}</h1>
            {stage !== "complete" && (
              <StudySidebar topics={sidebarData.topics} currentTopicId={Number(topicId)} onSelectTopic={goToTopic} />
            )}

            {stage === "reading" && (
              <StudyContentReader
                domainName={sidebarData.domain.name}
                topicTitle={start.topic.title}
                topicPosition={sidebarData.topics.findIndex((t) => t.id === start.topic.id) + 1}
                topicCount={sidebarData.topics.length}
                content={start.content}
                hasQuestions={totalQuestions > 0}
                onContinue={() => (totalQuestions > 0 ? setStage("transition") : handleFinishWithoutQuestions())}
              />
            )}

            {stage === "transition" && (
              <div className="flex flex-1">
                <StudyTransition topicTitle={start.topic.title} questionCount={totalQuestions} onStart={() => setStage("questions")} />
              </div>
            )}

            {stage === "questions" && currentQuestion && (
              <div className="min-w-0 flex-1">
                <div key={currentQuestion.id} className="animate-fade-in">
                  <StudyQuestion
                    question={currentQuestion}
                    questionNumber={currentIndex + 1}
                    totalQuestions={totalQuestions}
                    answer={answer}
                    onAnswerChange={(value) => {
                      if (result) return;
                      setAnswer(value);
                      setAnswerError("");
                    }}
                    onCheck={handleCheckAnswer}
                    isChecking={isChecking}
                    isAnswered={Boolean(result)}
                    result={result}
                  />

                  {answerError && <p className="mt-3 text-sm text-red-600">{answerError}</p>}

                  {result && (
                    <StudyAnswerFeedback
                      isCorrect={result.isCorrect}
                      correctAnswerText={result.correctAnswerText}
                      questionId={currentQuestion.id}
                      isLastQuestion={isLastQuestion}
                      onReviewConcept={() => setReviewOpen(true)}
                      onNext={handleNextQuestion}
                    />
                  )}
                </div>
              </div>
            )}

            {stage === "complete" && (
              <StudyCompletion
                domainName={sidebarData.domain.name}
                topicTitle={start.topic.title}
                domainId={domainId}
                questionsAnswered={completion?.questions_answered ?? 0}
                nextTopic={completion?.next_topic ?? null}
              />
            )}
          </div>
        )}
      </div>

      {/* "Review this concept": reopens the lesson content without losing
          question progress -- an in-page panel rather than navigating
          away, so there's no state to lose or restore. */}
      {reviewOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" role="dialog" aria-modal="true" aria-label="Review this concept">
          <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-6 shadow-lg sm:rounded-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">{start?.topic?.title}</h2>
              <button
                type="button"
                onClick={() => setReviewOpen(false)}
                className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            {start?.content ? (
              <RichText text={start.content.content} />
            ) : (
              <p className="text-sm text-gray-500">No reading content available.</p>
            )}
            <button
              type="button"
              onClick={() => setReviewOpen(false)}
              className="mt-6 w-full rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-indigo-500 active:scale-[0.98]"
            >
              Back to Question
            </button>
          </div>
        </div>
      )}

      <ConfirmModal
        open={Boolean(pendingTopicSwitch)}
        title="Switch topics?"
        message="You're partway through this topic's questions. Switching now won't lose your saved progress, but you'll restart these questions later."
        confirmLabel="Switch topic"
        cancelLabel="Stay here"
        onConfirm={() => {
          const target = pendingTopicSwitch;
          setPendingTopicSwitch(null);
          router.push(`/study/${domainId}/${target}`);
        }}
        onCancel={() => setPendingTopicSwitch(null)}
      />
    </div>
  );
}
