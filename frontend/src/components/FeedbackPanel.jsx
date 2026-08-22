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
    const hashHeadingMatch = /^(#{1,6})\s+(.+)$/.exec(line);
    if (boldHeadingMatch || hashHeadingMatch) {
      flushParagraph();
      flushList();
      // "## " (section, e.g. "Correct Answer") vs "### " (per-option
      // subsection inside the "other options" section) -- a bare
      // **bold** line defaults to a level-2 section for backward
      // compatibility with explanations cached before this format.
      const level = hashHeadingMatch ? hashHeadingMatch[1].length : 2;
      const headingText = hashHeadingMatch ? hashHeadingMatch[2] : boldHeadingMatch[1];
      blocks.push({ type: "heading", level, text: headingText.trim() });
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

// Renders a run of non-heading blocks (paragraphs/lists/tables) -- shared
// by both a top-level section's own content and a per-option subsection's
// content nested inside it.
function renderBlocks(blocks, keyPrefix) {
  return blocks.map((block, i) => {
    const key = `${keyPrefix}-${i}`;
    if (block.type === "ul") {
      return (
        <ul key={key} className="list-disc space-y-1 pl-5">
          {block.items.map((item, j) => (
            <li key={j} className="text-sm leading-relaxed text-gray-700">
              {renderInline(item, `${key}-${j}`)}
            </li>
          ))}
        </ul>
      );
    }
    if (block.type === "ol") {
      return (
        <ol key={key} className="list-decimal space-y-1 pl-5">
          {block.items.map((item, j) => (
            <li key={j} className="text-sm leading-relaxed text-gray-700">
              {renderInline(item, `${key}-${j}`)}
            </li>
          ))}
        </ol>
      );
    }
    if (block.type === "table") {
      return (
        <div key={key} className="overflow-x-auto rounded-md border border-gray-200">
          <table className="w-full border-collapse text-sm">
            {block.header && (
              <thead>
                <tr className="bg-gray-50">
                  {block.header.map((cell, c) => (
                    <th
                      key={c}
                      className="border-b border-gray-200 px-2.5 py-1.5 text-left font-semibold text-gray-900"
                    >
                      {renderInline(cell, `${key}-h-${c}`)}
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
                      {renderInline(cell, `${key}-${r}-${c}`)}
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
      <p key={key} className="text-sm leading-relaxed text-gray-700">
        {renderInline(block.text, key)}
      </p>
    );
  });
}

// Groups the flat block list into sections: a level-2 heading ("## ...")
// starts a new section, a level-3 heading ("### ...") starts a
// subsection nested inside the current section -- this is how "Why Are
// the Other Options Incorrect?" ends up with one subsection per option.
// Content before any heading (old cached explanations, or the fallback
// text) becomes a single headless section, rendered plainly.
function groupSections(blocks) {
  const sections = [];
  let currentSection = null;
  let currentSubsection = null;

  const ensureSection = () => {
    if (!currentSection) {
      currentSection = { heading: null, blocks: [], subsections: [] };
      sections.push(currentSection);
    }
    return currentSection;
  };

  for (const block of blocks) {
    if (block.type === "heading" && block.level <= 2) {
      currentSection = { heading: block.text, blocks: [], subsections: [] };
      currentSubsection = null;
      sections.push(currentSection);
      continue;
    }
    if (block.type === "heading") {
      currentSubsection = { heading: block.text, blocks: [] };
      ensureSection().subsections.push(currentSubsection);
      continue;
    }
    if (currentSubsection) {
      currentSubsection.blocks.push(block);
    } else {
      ensureSection().blocks.push(block);
    }
  }
  return sections;
}

function classifySection(heading) {
  if (!heading) return "plain";
  if (/correct answer/i.test(heading)) return "correct";
  if (/exam tip/i.test(heading)) return "examTip";
  if (/key concept/i.test(heading)) return "keyConcept";
  return "plain";
}

function ExplanationText({ text }) {
  const sections = groupSections(parseExplanationBlocks(text));

  return (
    <div className="space-y-5">
      {sections.map((section, i) => {
        const kind = classifySection(section.heading);
        const key = `sec-${i}`;

        if (kind === "correct") {
          return (
            <div key={key} className="rounded-lg border border-green-200 bg-green-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-green-700">{section.heading}</p>
              <div className="mt-1 text-[15px] font-medium text-green-900">{renderBlocks(section.blocks, key)}</div>
            </div>
          );
        }

        if (kind === "examTip" || kind === "keyConcept") {
          const isExamTip = kind === "examTip";
          return (
            <div key={key} className={`border-l-2 pl-3 ${isExamTip ? "border-indigo-300" : "border-gray-300"}`}>
              <p
                className={`text-xs font-semibold uppercase tracking-wide ${
                  isExamTip ? "text-indigo-700" : "text-gray-500"
                }`}
              >
                {section.heading}
              </p>
              <div className="mt-1 space-y-2">{renderBlocks(section.blocks, key)}</div>
            </div>
          );
        }

        return (
          <div key={key}>
            {section.heading && <h3 className="mb-1.5 text-sm font-semibold text-gray-900">{section.heading}</h3>}
            <div className="space-y-2">{renderBlocks(section.blocks, key)}</div>
            {section.subsections.length > 0 && (
              <div className="mt-3 space-y-2">
                {section.subsections.map((sub, j) => (
                  <div key={`${key}-sub-${j}`} className="rounded-md border border-red-100 bg-red-50/70 px-3 py-2">
                    <p className="text-sm font-semibold text-red-800">{renderInline(sub.heading, `${key}-sub-${j}-h`)}</p>
                    <div className="mt-1 space-y-1.5">{renderBlocks(sub.blocks, `${key}-sub-${j}`)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
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
