// Lightweight markdown-subset renderer shared by AI explanations
// (FeedbackPanel) and Study Mode's lesson content (StudyContentReader,
// StudyAnswerFeedback) -- both are authored/generated in the same
// convention: **bold** section labels or #/## headings, "- "/"* "
// bullets, "1. " numbered lines, "| cell |" tables, blank-line
// paragraphs. Deliberately not a full markdown renderer -- just enough
// structure to read as headings/bullets/numbered-steps/tables/
// paragraphs, while staying simple enough to render safely (see
// renderInline -- never dangerouslySetInnerHTML).

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

export function parseTextBlocks(text) {
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
      // "## " (section) vs "### " (subsection) -- a bare **bold** line
      // defaults to a level-2 section for backward compatibility with
      // content authored before headings existed.
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
// elements (never dangerouslySetInnerHTML) so arbitrary AI-generated or
// admin-authored text can't inject markup. Bold is checked first in the
// alternation so "**x**" isn't misread as italic before the wider bold
// match applies.
export function renderInline(text, keyPrefix) {
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
export function renderTextBlocks(blocks, keyPrefix) {
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
// subsection nested inside the current section. Content before any
// heading becomes a single headless section, rendered plainly.
export function groupTextSections(blocks) {
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

// Recognizes section headings from both AI explanations ("Correct
// Answer", "Exam Tip", "Key Concept") and Study Mode lesson content
// ("Key idea", "Key points") so both can render as the same style of
// highlighted callout instead of a plain heading + paragraph.
function classifySection(heading) {
  if (!heading) return "plain";
  if (/correct answer/i.test(heading)) return "correct";
  if (/exam tip/i.test(heading)) return "examTip";
  if (/key point/i.test(heading)) return "keyPoints";
  if (/key concept|key idea/i.test(heading)) return "keyConcept";
  return "plain";
}

// The shared renderer: parses `text` (the markdown subset above),
// groups it into sections, and renders each with styling appropriate to
// what kind of section it is. Used for AI-generated answer explanations
// (FeedbackPanel) and admin-authored Study Mode lesson content
// (StudyContentReader, StudyAnswerFeedback's "From what you just
// learned" recap).
export function RichText({ text }) {
  const sections = groupTextSections(parseTextBlocks(text));

  return (
    <div className="space-y-5">
      {sections.map((section, i) => {
        const kind = classifySection(section.heading);
        const key = `sec-${i}`;

        if (kind === "correct") {
          return (
            <div key={key} className="rounded-lg border border-green-200 bg-green-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-green-700">{section.heading}</p>
              <div className="mt-1 text-[15px] font-medium text-green-900">
                {renderTextBlocks(section.blocks, key)}
              </div>
            </div>
          );
        }

        if (kind === "keyPoints") {
          return (
            <div key={key} className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">{section.heading}</p>
              <ul className="mt-2 space-y-1.5">
                {section.blocks
                  .filter((block) => block.type === "ul" || block.type === "ol")
                  .flatMap((block) => block.items)
                  .map((item, j) => (
                    <li key={j} className="flex items-start gap-2 text-sm leading-relaxed text-emerald-900">
                      <span aria-hidden="true" className="mt-0.5 text-emerald-600">
                        ✓
                      </span>
                      <span>{renderInline(item, `${key}-kp-${j}`)}</span>
                    </li>
                  ))}
              </ul>
            </div>
          );
        }

        if (kind === "examTip" || kind === "keyConcept") {
          const isExamTip = kind === "examTip";
          return (
            <div key={key} className={`border-l-2 pl-3 ${isExamTip ? "border-indigo-300" : "border-amber-300"}`}>
              <p
                className={`text-xs font-semibold uppercase tracking-wide ${
                  isExamTip ? "text-indigo-700" : "text-amber-700"
                }`}
              >
                {section.heading}
              </p>
              <div className="mt-1 space-y-2">{renderTextBlocks(section.blocks, key)}</div>
            </div>
          );
        }

        return (
          <div key={key}>
            {section.heading && <h3 className="mb-1.5 text-sm font-semibold text-gray-900">{section.heading}</h3>}
            <div className="space-y-2">{renderTextBlocks(section.blocks, key)}</div>
            {section.subsections.length > 0 && (
              <div className="mt-3 space-y-2">
                {section.subsections.map((sub, j) => (
                  <div key={`${key}-sub-${j}`} className="rounded-md border border-red-100 bg-red-50/70 px-3 py-2">
                    <p className="text-sm font-semibold text-red-800">{renderInline(sub.heading, `${key}-sub-${j}-h`)}</p>
                    <div className="mt-1 space-y-1.5">{renderTextBlocks(sub.blocks, `${key}-sub-${j}`)}</div>
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
