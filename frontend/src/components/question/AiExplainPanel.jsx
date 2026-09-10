import { useEffect, useState } from "react";
import { Sparkles, Lightbulb } from "lucide-react";
import { fetchExplanation } from "../../services/explanationsService";
import { RichText } from "../../utils/richText";
import { cn } from "../../lib/cn";

// The "Ask AI to explain" rail. Backed by the existing one-shot, cached
// /explain/ endpoint -- the prompt chips are shortcuts that all request
// the same full explanation (there is no multi-turn chat backend, so this
// panel does not pretend to have one). `available` is false until the
// learner has locked in an answer, so the exam can't be used to reveal
// the key early.
const PROMPT_CHIPS = [
  "Why is this answer correct?",
  "Why are the other options wrong?",
  "Give me a real-world example",
  "What's the key concept here?",
];

export default function AiExplainPanel({ questionId, available = true, className = "" }) {
  const [explanation, setExplanation] = useState(null);
  const [isFallback, setIsFallback] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  // A new question clears whatever was shown for the previous one.
  useEffect(() => {
    setExplanation(null);
    setIsFallback(false);
    setError("");
    setIsLoading(false);
  }, [questionId]);

  async function loadExplanation() {
    if (isLoading || explanation) return;
    setIsLoading(true);
    setError("");
    try {
      const data = await fetchExplanation(questionId);
      setExplanation(data.explanation);
      setIsFallback(Boolean(data.is_fallback));
    } catch {
      setError("Couldn't load an explanation. Try again in a moment.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <aside
      className={cn(
        "flex flex-col rounded-xl border border-border bg-surface p-5",
        className
      )}
      aria-label="AI explanation"
    >
      <p className="flex items-center gap-2 text-body-sm font-semibold text-text-primary">
        <Sparkles className="h-4 w-4 text-test" aria-hidden="true" />
        Ask AI to explain
      </p>

      <div className="mt-3 rounded-lg bg-surface-muted p-3 text-body-sm text-text-secondary">
        Hi! I&apos;m your AI tutor. Get a plain-language explanation of this question and the
        concepts behind it.
      </div>

      {!available ? (
        <p className="mt-4 text-caption text-text-muted">
          Submit your answer to unlock an explanation for this question.
        </p>
      ) : (
        <>
          {!explanation && (
            <div className="mt-4 space-y-2">
              <div className="flex flex-wrap gap-1.5">
                {PROMPT_CHIPS.map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    onClick={loadExplanation}
                    disabled={isLoading}
                    className="rounded-full border border-test/25 bg-test-muted/40 px-2.5 py-1 text-caption font-medium text-test transition-colors hover:bg-test-muted disabled:opacity-50"
                  >
                    {chip}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={loadExplanation}
                disabled={isLoading}
                className="mt-1 inline-flex items-center gap-1.5 text-body-sm font-medium text-primary hover:underline disabled:opacity-50"
              >
                <Lightbulb className="h-4 w-4" aria-hidden="true" />
                {isLoading ? "Asking the AI tutor…" : "Explain this answer"}
              </button>
            </div>
          )}

          {error && <p className="mt-3 text-body-sm text-error">{error}</p>}

          {explanation && (
            <div className="mt-4 rounded-lg border border-border bg-surface-muted/60 p-4">
              {isFallback && (
                <p className="mb-1.5 text-caption font-medium text-warning">
                  The AI tutor is unavailable right now. Here&apos;s a basic explanation.
                </p>
              )}
              <RichText text={explanation} />
            </div>
          )}
        </>
      )}

      <p className="mt-4 border-t border-border pt-3 text-caption text-text-muted">
        AI responses may contain mistakes. Scoring is always rule-based, never AI.
      </p>
    </aside>
  );
}
