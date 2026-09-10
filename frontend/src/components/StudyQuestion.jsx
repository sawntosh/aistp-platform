import QuestionBody from "./question/QuestionBody";
import QuestionMetaBar from "./question/QuestionMetaBar";
import Button from "./ui/Button";
import { Card } from "./ui/Card";

function isAnswerReady(question, answer) {
  const qtype = question.question_type;
  if (qtype === "multi_select") return Array.isArray(answer) && answer.length > 0;
  if (qtype === "fill_blank") return typeof answer === "string" && answer.trim().length > 0;
  if (qtype === "matching") {
    return (
      answer &&
      typeof answer === "object" &&
      question.matching_pairs.every((pair) => Boolean(answer[pair.id]))
    );
  }
  return answer !== null && answer !== undefined;
}

export default function StudyQuestion({
  question,
  questionNumber,
  totalQuestions,
  answer,
  onAnswerChange,
  onCheck,
  isChecking,
  isAnswered,
  result,
}) {
  if (!question) return null;
  const canCheck = isAnswerReady(question, answer);

  return (
    <Card className="p-6">
      <p className="mb-1 text-label uppercase tracking-wide text-study">
        Knowledge Check &middot; Question {questionNumber} of {totalQuestions}
      </p>

      <QuestionMetaBar question={question} showType showDifficulty={false} showDomain={false} />

      <h2 className="text-h3 font-semibold leading-snug text-text-primary">{question.text}</h2>

      {question.image && (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={question.image}
          alt=""
          className="mt-4 max-h-96 w-full rounded-lg border border-border object-contain"
        />
      )}

      <div className="mt-5">
        <QuestionBody
          question={question}
          answer={answer}
          onAnswerChange={onAnswerChange}
          disabled={isAnswered}
          revealed={isAnswered}
          result={result}
          accent="study"
        />
      </div>

      {!isAnswered && (
        <Button
          tone="study"
          onClick={onCheck}
          disabled={!canCheck}
          isLoading={isChecking}
          className="mt-5 w-full sm:w-auto"
        >
          {isChecking ? "Checking…" : "Check Answer"}
        </Button>
      )}
    </Card>
  );
}
