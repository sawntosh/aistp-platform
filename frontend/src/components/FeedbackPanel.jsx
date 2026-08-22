import { useState } from "react";
import { fetchExplanation } from "../services/explanationsService";

// A "| cell | cell |" row belonging to a markdown table. The AI prompt
// asks the model not to use tables, but models don't always comply --
// this is a safety net so a table still renders as one instead of
// collapsing into an unreadable run-on line of pipe characters.
function isTableRow(line) {
  return /^\|.*\|$/.test(line);
}
function isSeparatorRow(cells) {
  return cells.length > 0 && cells.every((cell) => /^:?-{2,}:?$/.test(cell));
}
function splitTableRow(line) {
  return line
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

// Parses the lightweight markdown subset the AI explanation prompt asks
// for: **bold** section labels on their own line (or a leading #/##
// heading, tolerated as a safety net even though the prompt discourages
// it), "- "/"* " bullet lines, "1. " numbered lines, "| cell |" table
// rows, and blank lines separating paragraphs. Deliberately not a full
// markdown renderer -- just enough structure to read the AI tutor's
// answer as headings/bullets/numbered-steps/tables/paragraphs instead of
// one flat wall of text, while staying simple enough to render safely
// (see renderInline).
function parseExplanationBlocks(text) {
  const blocks = [];
  let paragraphLines = [];
  let listItems = [];
  let listType = null; // "ul" | "ol"
  let tableLines = [];

  const flushParagraph = () => {
    if (paragraphLines.length) {
      blocks.push({ type: "p", text: paragraphLines.join(" ") });
      paragraphLines = [];
    }
  };
  const flushList = () => {
    if (listItems.length) {
      blocks.push({ type: listType, items: listItems });
      listItems = [];
    }
    listType = null;
  };
  const flushTable = () => {
    if (!tableLines.length) return;
    const rows = tableLines.map(splitTableRow);
    let header = null;
    let body = rows;
    if (rows.length > 1 && isSeparatorRow(rows[1])) {
      header = rows[0];
      body = rows.slice(2);
    }
    blocks.push({ type: "table", header, rows: body });
    tableLines = [];
  };

  for (const rawLine of text.replace(/\r\n/g, "\n").split("\n")) {
    const line = rawLine.trim();
    if (!line) {
      flushParagraph();
      flushList();
      flushTable();
      continue;
    }

    if (isTableRow(line)) {
      flushParagraph();
      flushList();
      tableLines.push(line);
      continue;
    }
    flushTable();

    const boldHeadingMatch = /^\*\*(.+)\*\*$/.exec(line);
    const hashHeadingMatch = /^#{1,6}\s+(.+)$/.exec(line);
    if (boldHeadingMatch || hashHeadingMatch) {
      flushParagraph();
      flushList();
      blocks.push({ type: "heading", text: (boldHeadingMatch || hashHeadingMatch)[1].trim() });
      continue;
    }

    const bulletMatch = /^[-*]\s+(.*)$/.exec(line);
    if (bulletMatch) {
      flushParagraph();
      if (listType && listType !== "ul") flushList();
      listType = "ul";
      listItems.push(bulletMatch[1]);
      continue;
    }

    const numberedMatch = /^\d+[.)]\s+(.*)$/.exec(line);
    if (numberedMatch) {
      flushParagraph();
      if (listType && listType !== "ol") flushList();
      listType = "ol";
      listItems.push(numberedMatch[1]);
      continue;
    }

    flushList();
    paragraphLines.push(line);
  }
  flushParagraph();
  flushList();
  flushTable();
  return blocks;
}

// Renders inline **bold** and *italic* spans within a line as real
// elements (never dangerouslySetInnerHTML) so arbitrary AI-generated
// text can't inject markup. Bold is checked first in the alternation so
// "**x**" isn't misread as italic before the wider bold match applies.
function renderInline(text, keyPrefix) {
  return text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={`${keyPrefix}-${i}`}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("*") && part.endsWith("*")) {
      return <em key={`${keyPrefix}-${i}`}>{part.slice(1, -1)}</em>;
    }
    return <span key={`${keyPrefix}-${i}`}>{part}</span>;
  });
}

function ExplanationText({ text }) {
  return (
    <div className="space-y-2">
      {parseExplanationBlocks(text).map((block, i) => {
        if (block.type === "heading") {
          return (
            <p key={i} className="text-sm font-semibold text-gray-900">
              {renderInline(block.text, `${i}`)}
            </p>
          );
        }
        if (block.type === "ul") {
          return (
            <ul key={i} className="list-disc space-y-1 pl-5">
              {block.items.map((item, j) => (
                <li key={j} className="text-sm text-gray-700">
                  {renderInline(item, `${i}-${j}`)}
                </li>
              ))}
            </ul>
          );
        }
        if (block.type === "ol") {
          return (
            <ol key={i} className="list-decimal space-y-1 pl-5">
              {block.items.map((item, j) => (
                <li key={j} className="text-sm text-gray-700">
                  {renderInline(item, `${i}-${j}`)}
                </li>
              ))}
            </ol>
          );
        }
        if (block.type === "table") {
          return (
            <div key={i} className="overflow-x-auto rounded-md border border-gray-200">
              <table className="w-full border-collapse text-sm">
                {block.header && (
                  <thead>
                    <tr className="bg-gray-50">
                      {block.header.map((cell, c) => (
                        <th
                          key={c}
                          className="border-b border-gray-200 px-2.5 py-1.5 text-left font-semibold text-gray-900"
                        >
                          {renderInline(cell, `${i}-h-${c}`)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                )}
                <tbody>
                  {block.rows.map((row, r) => (
                    <tr key={r}>
                      {row.map((cell, c) => (
                        <td key={c} className="border-b border-gray-100 px-2.5 py-1.5 align-top text-gray-700">
                          {renderInline(cell, `${i}-${r}-${c}`)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }
        return (
          <p key={i} className="text-sm text-gray-700">
            {renderInline(block.text, `${i}`)}
          </p>
        );
      })}
    </div>
  );
}

export default function FeedbackPanel({
  isCorrect,
  correctOptionText,
  questionId,
  onNext,
  isLastQuestion,
}) {
  const [explanation, setExplanation] = useState(null);
  const [isExplanationFallback, setIsExplanationFallback] = useState(false);
  const [isLoadingExplanation, setIsLoadingExplanation] = useState(false);
  const [explanationError, setExplanationError] = useState("");

  async function handleExplain() {
    setIsLoadingExplanation(true);
    setExplanationError("");
    try {
      const data = await fetchExplanation(questionId);
      setExplanation(data.explanation);
      setIsExplanationFallback(Boolean(data.is_fallback));
    } catch {
      setExplanationError("Couldn't load an explanation right now. Try again.");
    } finally {
      setIsLoadingExplanation(false);
    }
  }

  return (
    <div
      className={`rounded-xl border p-6 mt-4 animate-pop ${
        isCorrect ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"
      }`}
    >
      <p
        className={`flex items-center gap-1.5 font-semibold ${
          isCorrect ? "text-green-800" : "text-red-800"
        }`}
      >
        {isCorrect ? (
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
            <path
              fillRule="evenodd"
              d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z"
              clipRule="evenodd"
            />
          </svg>
        ) : (
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
            <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
          </svg>
        )}
        {isCorrect ? "Correct!" : "Not quite."}
      </p>
      {!isCorrect && (
        <p className="mt-1 text-sm text-gray-700">
          Correct answer: <span className="font-medium">{correctOptionText}</span>
        </p>
      )}

      <div className="mt-4">
        {!explanation && (
          <button
            type="button"
            onClick={handleExplain}
            disabled={isLoadingExplanation}
            className="text-sm font-medium text-indigo-600 hover:underline disabled:opacity-50"
          >
            {isLoadingExplanation ? "Asking AI tutor…" : "Explain this answer"}
          </button>
        )}
        {explanationError && <p className="mt-2 text-sm text-red-600">{explanationError}</p>}
        {explanation && (
          <div className="mt-2 rounded-lg bg-white border border-gray-200 p-3">
            {isExplanationFallback && (
              <p className="mb-1.5 text-xs font-medium text-amber-600">
                AI tutor is temporarily unavailable — showing a basic explanation.
              </p>
            )}
            <ExplanationText text={explanation} />
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={onNext}
        className="mt-4 w-full rounded-md bg-gray-900 px-3 py-2 text-sm font-medium text-white transition-all hover:bg-gray-800 active:scale-[0.98]"
      >
        {isLastQuestion ? "Finish session" : "Next question"}
      </button>
    </div>
  );
}
