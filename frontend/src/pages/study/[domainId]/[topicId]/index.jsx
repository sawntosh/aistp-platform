import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { BookOpen, ChevronLeft } from "lucide-react";
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
import Dialog from "../../../../components/ui/Dialog";
import Skeleton from "../../../../components/ui/Skeleton";
import ErrorState from "../../../../components/ui/ErrorState";
import Button from "../../../../components/ui/Button";
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
      setAnswerError("Couldn't check your answer. Try again.");
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
    <div className="min-h-[calc(100vh-57px)] sm:min-h-screen bg-background px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <div className="flex items-center gap-3">
          <Link
            href={`/study/${domainId}`}
            className="flex items-center gap-1 text-body-sm font-medium text-text-muted transition-colors hover:text-text-primary"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            {sidebarData?.domain?.name ?? "Study"}
          </Link>
          <span className="flex items-center gap-1 text-label uppercase tracking-wide text-study">
            <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
            Study Mode
          </span>
        </div>

        {pageState === "loading" && (
          <div className="mt-8 space-y-4" aria-busy="true" aria-label="Loading study content">
            <Skeleton className="h-7 w-1/3" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-40 w-full" />
          </div>
        )}

        {pageState === "error" && (
          <ErrorState
            className="mt-8"
            title="Couldn't load this topic"
            description="Something went wrong. Try again."
            onRetry={loadTopic}
          />
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

                  {answerError && <p className="mt-3 text-body-sm text-error">{answerError}</p>}

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
      <Dialog open={reviewOpen} onClose={() => setReviewOpen(false)} title={start?.topic?.title} className="max-w-lg">
        {start?.content ? (
          <div className="mt-3 max-h-[60vh] overflow-y-auto pr-1">
            <RichText text={start.content.content} variant="reading" />
          </div>
        ) : (
          <p className="text-body-sm text-text-muted">No reading content available.</p>
        )}
        <Button tone="study" onClick={() => setReviewOpen(false)} className="mt-6 w-full">
          Back to Question
        </Button>
      </Dialog>

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
