"""
services/question_generation_service.py

RAG-based question generation for the admin "Generate from document"
workflow (questions.views.GenerationJobViewSet). Ported from the
standalone rag_app.py script the platform previously used offline:
extracts a PDF/DOCX syllabus, chunks it by domain/subsection/learning
objective, builds a TF-IDF retriever, and asks an LLM to write one
question at a time, grounded in the retrieved syllabus context.

Differences from the original script:
- Groq (free, hosted, no local server) replaces Ollama, using the same
  GROQ_API_KEY as services/explanation_service.py's AI answer
  explanations -- one AI provider/key for the whole app, not a mix of
  providers. See GENERATION_PACING_SECONDS below for why pacing still
  matters even on Groq's generous free tier.
- Supports .docx in addition to .pdf.
- Generates five question types (mcq, true_false, multi_select,
  fill_blank, matching), not just MCQ.
- Persists straight into the Question/AnswerOption/FillBlankAnswer/
  MatchingPair tables instead of writing CSV/JSON files.

Entry point: run_generation(job_id), called on a background thread by
questions.views.GenerationJobViewSet.create.
"""
import itertools
import json
import logging
import os
import re
import time
from typing import Dict, List, Optional, Tuple

from django.db import transaction
from groq import AuthenticationError, Groq, PermissionDeniedError, RateLimitError

from questions.models import AnswerOption, Domain, FillBlankAnswer, GenerationJob, MatchingPair, Question

logger = logging.getLogger(__name__)

# Unlike the old Gemini client, Groq's constructor raises immediately if
# api_key is None -- fall back to a dummy value so a missing key fails
# at the point of an actual API call (handled gracefully, see
# is_unrecoverable_error) instead of crashing Django app loading itself.
groq_client = Groq(api_key=os.getenv("GROQ_API_KEY") or "not-configured")

LLM_MAX_ATTEMPTS = 2

# Even Groq's much higher free-tier RPM can be tripped by generating
# dozens of questions back-to-back with no delay at all. Pace every call
# and, when a rate limit is hit anyway, back off and retry rather than
# treating it as a permanent failure (see is_unrecoverable_error below).
GENERATION_PACING_SECONDS = float(os.getenv("GENERATION_PACING_SECONDS", "1.5"))
RATE_LIMIT_MAX_ATTEMPTS = int(os.getenv("GENERATION_RATE_LIMIT_MAX_ATTEMPTS", "5"))
RATE_LIMIT_BACKOFF_SECONDS = float(os.getenv("GENERATION_RATE_LIMIT_BACKOFF_SECONDS", "15"))

# Canonical domain names -- must match questions/fixtures/seed_questions.json
# exactly so generated questions land on the same Domain rows as the
# seeded question bank instead of creating duplicates.
DOMAIN_TITLES = [
    "Domain 1: Fundamental of Testing",
    "Domain 2 - Testing Throughout the Software Development Lifecycle",
    "Domain 3 - Static Testing",
    "Domain 4 - Test Analysis and Design",
    "Domain 5 - Managing Test Activities",
    "Domain 6 - Test Tools",
]

K_TO_DIFFICULTY = {"K1": "easy", "K2": "medium", "K3": "hard"}

K_LEVEL_DESC = {
    "K1": "remember - recall a term, fact, concept, or definition",
    "K2": "understand - explain, summarize, classify, compare, or distinguish a concept",
    "K3": "apply - apply a testing concept or technique to a given situation or scenario",
}

ALL_QUESTION_TYPES = [choice for choice, _ in Question.QuestionType.choices]


class GenerationError(Exception):
    """Raised for any unrecoverable failure of a generation job."""


# ============================================================
# TEXT EXTRACTION
# ============================================================

def clean_text(text: str) -> str:
    if not text:
        return ""
    text = re.sub(r"v4\.0\.1\s+Page\s+\d+\s+of\s+\d+", "", text, flags=re.IGNORECASE)
    text = re.sub(r"©?\s*International Software Testing Qualifications Board", "", text, flags=re.IGNORECASE)
    text = re.sub(r"Certified Tester\s*Foundation Level", "", text, flags=re.IGNORECASE)
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def extract_pdf_text(path: str) -> str:
    import pdfplumber

    pages = []
    with pdfplumber.open(path) as pdf:
        for page in pdf.pages:
            try:
                text = page.extract_text() or ""
            except Exception:
                text = ""
            if text.strip():
                pages.append(text)
    return clean_text("\n".join(pages))


def extract_docx_text(path: str) -> str:
    import docx

    document = docx.Document(path)
    paragraphs = [p.text for p in document.paragraphs]
    return clean_text("\n".join(paragraphs))


def extract_document_text(path: str, filename: str) -> str:
    extension = os.path.splitext(filename)[1].lower()
    if extension == ".pdf":
        text = extract_pdf_text(path)
    elif extension == ".docx":
        text = extract_docx_text(path)
    else:
        raise GenerationError(f"Unsupported file type '{extension}'. Upload a PDF or DOCX file.")

    if not text:
        raise GenerationError("No text could be extracted from the uploaded document.")
    return text


# ============================================================
# CHAPTER / SUBSECTION / LEARNING OBJECTIVE EXTRACTION
# ============================================================

CHAPTER_RE = re.compile(r"\n([1-6])\.\s+([A-Za-z][^\n]{3,150})\n", re.MULTILINE)
# Trailing period after the section number is optional: the syllabus
# formats subsection headings as "1.1 What is Testing?", not "1.1. What
# is Testing?" -- only the chapter headings above use a literal period.
SUBSECTION_RE = re.compile(r"\n(\d+\.\d+(?:\.\d+)?)\.?\s+([^\n]{3,150})\n", re.MULTILINE)
LO_RE = re.compile(r"FL-(\d+\.\d+\.\d+)\s*\((K[1-3])\)\s*([^\n]+)", re.MULTILINE)


def extract_chapters(full_text: str) -> Dict[str, str]:
    matches = list(CHAPTER_RE.finditer(full_text))
    if not matches:
        raise GenerationError(
            "Could not find chapter headings (e.g. '1. Fundamentals of Testing') in the "
            "uploaded document. Upload the ISTQB CTFL syllabus PDF/DOCX."
        )

    grouped: Dict[str, list] = {}
    for match in matches:
        grouped.setdefault(match.group(1), []).append(match)

    selected = []
    for number in range(1, 7):
        number = str(number)
        if number not in grouped:
            raise GenerationError(f"Could not find chapter {number} in the uploaded document.")
        selected.append(grouped[number][-1])  # last occurrence = actual body heading, not TOC
    selected.sort(key=lambda m: m.start())

    chapters = {}
    for index, match in enumerate(selected):
        start = match.start()
        end = selected[index + 1].start() if index + 1 < len(selected) else len(full_text)
        chapter_text = full_text[start:end]

        if index == 5:
            for marker in ["\n7. References", "\nReferences", "\nIndex"]:
                marker_position = chapter_text.find(marker)
                if marker_position != -1:
                    chapter_text = chapter_text[:marker_position]
                    break

        chapters[DOMAIN_TITLES[index]] = clean_text(chapter_text)

    return chapters


def extract_learning_objectives(chapter_text: str) -> List[Dict]:
    return [
        {"id": m.group(1), "k": m.group(2), "text": m.group(3).strip()}
        for m in LO_RE.finditer(chapter_text)
    ]


def find_learning_objectives_for_section(section_id: str, learning_objectives: List[Dict]) -> List[Dict]:
    return [
        lo for lo in learning_objectives
        if lo["id"] == section_id or lo["id"].startswith(section_id + ".")
    ]


def chunk_chapter(domain: str, chapter_text: str) -> List[Dict]:
    chapter_text = clean_text(chapter_text)
    learning_objectives = extract_learning_objectives(chapter_text)
    headers = list(SUBSECTION_RE.finditer(chapter_text))

    chunks = []
    for index, header in enumerate(headers):
        section_id = header.group(1)
        section_title = header.group(2).strip()
        start = header.end()
        end = headers[index + 1].start() if index + 1 < len(headers) else len(chapter_text)
        body = clean_text(chapter_text[start:end])

        if len(body) < 40:
            continue

        matching_los = find_learning_objectives_for_section(section_id, learning_objectives)
        chunks.append(
            {
                "domain": domain,
                "section_id": section_id,
                "section_title": section_title,
                "k_levels": sorted(set(lo["k"] for lo in matching_los)),
                "learning_objectives": matching_los,
                "text": body,
            }
        )

    return chunks


def build_all_chunks(chapters: Dict[str, str]) -> List[Dict]:
    all_chunks = []
    for domain, chapter_text in chapters.items():
        all_chunks.extend(chunk_chapter(domain, chapter_text))

    if not all_chunks:
        raise GenerationError(
            "Chapter headings were found, but no subsection headings (e.g. '1.1 What is "
            "Testing?') could be parsed inside them, so there is no syllabus content to "
            "generate questions from. The document's formatting may not match the ISTQB "
            "CTFL syllabus layout this parser expects."
        )

    return all_chunks


# ============================================================
# RAG RETRIEVER
# ============================================================

class SyllabusRetriever:
    """TF-IDF + cosine-similarity retriever over the syllabus chunks."""

    def __init__(self, chunks: List[Dict]):
        from sklearn.feature_extraction.text import TfidfVectorizer

        self.chunks = chunks
        documents = []
        for chunk in chunks:
            lo_text = " ".join(lo["text"] for lo in chunk["learning_objectives"])
            documents.append(f"{chunk['section_id']} {chunk['section_title']} {lo_text} {chunk['text']}")

        self.vectorizer = TfidfVectorizer(stop_words="english", max_df=0.95, ngram_range=(1, 2))
        self.matrix = self.vectorizer.fit_transform(documents)

    def retrieve(self, query: str, domain: Optional[str] = None, top_k: int = 3) -> List[Tuple[float, Dict]]:
        from sklearn.metrics.pairwise import cosine_similarity

        query_vector = self.vectorizer.transform([query])
        similarities = cosine_similarity(query_vector, self.matrix).flatten()
        ranked_indices = similarities.argsort()[::-1]

        results = []
        for index in ranked_indices:
            chunk = self.chunks[index]
            if domain is not None and chunk["domain"] != domain:
                continue
            results.append((float(similarities[index]), chunk))
            if len(results) >= top_k:
                break
        return results


def build_retrieval_query(chunk: Dict, learning_objective: Dict) -> str:
    return f"{chunk['section_id']} {chunk['section_title']} {learning_objective['id']} {learning_objective['text']}"


def build_retrieved_context(retrieved_chunks: List[Tuple[float, Dict]]) -> str:
    parts = []
    for rank, (score, chunk) in enumerate(retrieved_chunks, start=1):
        if chunk["learning_objectives"]:
            lo_text = "\n".join(f"{lo['id']} ({lo['k']}): {lo['text']}" for lo in chunk["learning_objectives"])
        else:
            lo_text = "No explicit learning objective found."

        parts.append(
            f"\n--- RETRIEVED SOURCE {rank} (score {score:.4f}) ---\n"
            f"Section: {chunk['section_id']} {chunk['section_title']}\n"
            f"Learning Objectives:\n{lo_text}\n"
            f"Syllabus Content:\n{chunk['text']}\n"
        )
    return "\n".join(parts)


# ============================================================
# GROQ CALL
# ============================================================

# Fallback substring check for auth failures that don't come back as a
# groq.AuthenticationError/PermissionDeniedError instance (e.g. a plain
# connection-level error whose message still says so).
AUTH_ERROR_MARKERS = (
    "api key",
    "invalid_api_key",
    "unauthorized",
    "unauthenticated",
    "permission_denied",
    "permission denied",
)

# Fallback substring check for rate-limit failures that don't come back
# as a groq.RateLimitError instance.
RATE_LIMIT_ERROR_MARKERS = (
    "rate limit",
    "rate_limit",
    "too many requests",
    "429",
    "quota",
    "resource_exhausted",
)


def is_unrecoverable_error(exc: Exception) -> bool:
    """True only for errors that will never succeed on retry (bad API
    key / no permission). Rate limits are handled separately -- see
    is_rate_limit_error."""
    if isinstance(exc, (AuthenticationError, PermissionDeniedError)):
        return True
    text = str(exc).lower()
    return any(marker in text for marker in AUTH_ERROR_MARKERS)


def is_rate_limit_error(exc: Exception) -> bool:
    if isinstance(exc, RateLimitError):
        return True
    text = str(exc).lower()
    return any(marker in text for marker in RATE_LIMIT_ERROR_MARKERS)


def call_llm_json(prompt: str, model_name: str) -> str:
    last_error = None
    attempts = 0
    max_attempts = LLM_MAX_ATTEMPTS

    while attempts < max_attempts:
        attempts += 1
        try:
            response = groq_client.chat.completions.create(
                model=model_name,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.4,
                response_format={"type": "json_object"},
            )
        except Exception as exc:
            last_error = GenerationError(f"Groq request failed: {exc}")
            if is_unrecoverable_error(exc):
                break
            if is_rate_limit_error(exc):
                # Extend the retry budget the first time we see a rate
                # limit (rather than the generic 2 attempts) and back off
                # with increasing delay, since free-tier limits are
                # typically per-minute and just need time to reset.
                max_attempts = max(max_attempts, RATE_LIMIT_MAX_ATTEMPTS)
                backoff = RATE_LIMIT_BACKOFF_SECONDS * attempts
                logger.info("Groq rate limit hit, backing off %.0fs before retry %d/%d", backoff, attempts, max_attempts)
                time.sleep(backoff)
            continue

        text = (response.choices[0].message.content or "").strip()
        if text:
            return text
        last_error = GenerationError("Groq returned an empty response.")

    raise last_error


def clean_llm_json(raw: str) -> str:
    raw = raw.strip()
    raw = re.sub(r"^```(?:json)?", "", raw, flags=re.IGNORECASE)
    raw = re.sub(r"```$", "", raw).strip()
    start, end = raw.find("{"), raw.rfind("}")
    if start != -1 and end != -1 and end > start:
        raw = raw[start:end + 1]
    return raw.strip()


# ============================================================
# PROMPTS + VALIDATION, PER QUESTION TYPE
# ============================================================

_PROMPT_HEADER = """
You are an expert ISTQB Certified Tester Foundation Level (CTFL) v4.0.1
question writer. Use ONLY information supported by the provided context.
Do NOT use unrelated external knowledge. Do NOT copy sentences directly
from the syllabus.

DOMAIN: {domain}
SOURCE SECTION: {section_id} {section_title}
LEARNING OBJECTIVE ID: {lo_id}
LEARNING OBJECTIVE: {lo_text}
COGNITIVE LEVEL: {k_level} ({k_level_desc})

RETRIEVED SYLLABUS CONTEXT:
{retrieved_context}
"""

MCQ_PROMPT = _PROMPT_HEADER + """
Generate exactly ONE original multiple-choice question testing the above
learning objective, grounded in the retrieved context.

Requirements:
- Exactly four answer options (A-D), only one correct.
- Distractors must be plausible; never use "All/None of the above".
- Do not make the correct option obviously longer than the others.

Return ONLY this JSON object, no markdown, no commentary:
{{
    "question": "...",
    "options": {{"A": "...", "B": "...", "C": "...", "D": "..."}},
    "correct_option": "A"
}}
"""

TRUE_FALSE_PROMPT = _PROMPT_HEADER + """
Generate exactly ONE original true/false statement testing the above
learning objective, grounded in the retrieved context. Roughly half of
the statements you write across many calls should be false, so pick
truth value based on what's actually correct -- do not default to true.

Return ONLY this JSON object, no markdown, no commentary:
{{
    "statement": "...",
    "is_true": true
}}
"""

MULTI_SELECT_PROMPT = _PROMPT_HEADER + """
Generate exactly ONE original multiple-answer question (more than one
correct option) testing the above learning objective, grounded in the
retrieved context.

Requirements:
- Exactly four answer options (A-D).
- Exactly TWO or THREE of the four options must be correct (never one,
  never all four).
- Distractors must be plausible; never use "All/None of the above".

Return ONLY this JSON object, no markdown, no commentary:
{{
    "question": "...",
    "options": {{"A": "...", "B": "...", "C": "...", "D": "..."}},
    "correct_options": ["A", "C"]
}}
"""

FILL_BLANK_PROMPT = _PROMPT_HEADER + """
Generate exactly ONE original fill-in-the-blank question testing the
above learning objective, grounded in the retrieved context. The
question text MUST contain a blank shown as "_____" standing in for a
single key term or short phrase from the syllabus.

Return ONLY this JSON object, no markdown, no commentary:
{{
    "question": "... _____ ...",
    "answers": ["term", "accepted synonym"]
}}
"""

MATCHING_PROMPT = _PROMPT_HEADER + """
Generate exactly ONE original matching question testing the above
learning objective, grounded in the retrieved context: a short list of
terms/concepts, each paired with its correct short description.

Requirements:
- Produce between 3 and 5 pairs.
- Every prompt (left side) must be unique; every match (right side)
  must be unique and unambiguous -- it must not also correctly describe
  a different prompt in the same list.

Return ONLY this JSON object, no markdown, no commentary:
{{
    "instructions": "Match each term to its correct description.",
    "pairs": [
        {{"prompt": "...", "match": "..."}},
        {{"prompt": "...", "match": "..."}},
        {{"prompt": "...", "match": "..."}}
    ]
}}
"""

PROMPTS_BY_TYPE = {
    Question.QuestionType.MCQ: MCQ_PROMPT,
    Question.QuestionType.TRUE_FALSE: TRUE_FALSE_PROMPT,
    Question.QuestionType.MULTI_SELECT: MULTI_SELECT_PROMPT,
    Question.QuestionType.FILL_BLANK: FILL_BLANK_PROMPT,
    Question.QuestionType.MATCHING: MATCHING_PROMPT,
}


def _validate_mcq(data: Dict) -> Tuple[bool, str]:
    if not isinstance(data.get("question"), str) or len(data["question"].strip()) < 10:
        return False, "Question text missing or too short."
    options = data.get("options")
    if not isinstance(options, dict) or set(options.keys()) != {"A", "B", "C", "D"}:
        return False, "Options must contain exactly A, B, C and D."
    if any(not isinstance(v, str) or not v.strip() for v in options.values()):
        return False, "All options must be non-empty strings."
    if len({v.strip().lower() for v in options.values()}) != 4:
        return False, "Duplicate answer options detected."
    if data.get("correct_option") not in options:
        return False, "correct_option must be A, B, C or D."
    return True, "Valid"


def _validate_multi_select(data: Dict) -> Tuple[bool, str]:
    ok, message = _validate_mcq({**data, "correct_option": "A"})
    if not ok:
        return ok, message
    correct = data.get("correct_options")
    if not isinstance(correct, list) or not (2 <= len(correct) <= 3):
        return False, "correct_options must list two or three correct options."
    options = data["options"]
    if not set(correct).issubset(options.keys()) or len(set(correct)) != len(correct):
        return False, "correct_options must reference distinct existing options."
    return True, "Valid"


def _validate_true_false(data: Dict) -> Tuple[bool, str]:
    if not isinstance(data.get("statement"), str) or len(data["statement"].strip()) < 10:
        return False, "Statement missing or too short."
    if not isinstance(data.get("is_true"), bool):
        return False, "is_true must be a boolean."
    return True, "Valid"


def _validate_fill_blank(data: Dict) -> Tuple[bool, str]:
    question = data.get("question")
    if not isinstance(question, str) or len(question.strip()) < 10:
        return False, "Question text missing or too short."
    if "_____" not in question:
        return False, "Question text must contain a blank shown as '_____'."
    answers = data.get("answers")
    if not isinstance(answers, list) or not answers:
        return False, "answers must be a non-empty list."
    if any(not isinstance(a, str) or not a.strip() for a in answers):
        return False, "Every answer must be a non-empty string."
    return True, "Valid"


def _validate_matching(data: Dict) -> Tuple[bool, str]:
    pairs = data.get("pairs")
    if not isinstance(pairs, list) or not (3 <= len(pairs) <= 5):
        return False, "pairs must be a list of 3 to 5 items."
    prompts, matches = set(), set()
    for pair in pairs:
        if not isinstance(pair, dict):
            return False, "Each pair must be an object with prompt/match."
        prompt, match = pair.get("prompt"), pair.get("match")
        if not isinstance(prompt, str) or not prompt.strip() or not isinstance(match, str) or not match.strip():
            return False, "Each pair needs non-empty prompt and match text."
        prompts.add(prompt.strip().lower())
        matches.add(match.strip().lower())
    if len(prompts) != len(pairs) or len(matches) != len(pairs):
        return False, "Prompts and matches must be unique within the question."
    return True, "Valid"


VALIDATORS_BY_TYPE = {
    Question.QuestionType.MCQ: _validate_mcq,
    Question.QuestionType.TRUE_FALSE: _validate_true_false,
    Question.QuestionType.MULTI_SELECT: _validate_multi_select,
    Question.QuestionType.FILL_BLANK: _validate_fill_blank,
    Question.QuestionType.MATCHING: _validate_matching,
}


def dedupe_key_text(data: Dict, qtype: str) -> str:
    """The bit of generated text used for cross-question duplicate detection."""
    if qtype == Question.QuestionType.TRUE_FALSE:
        return data["statement"]
    if qtype == Question.QuestionType.MATCHING:
        return data.get("instructions", "") + " " + " ".join(p["prompt"] for p in data["pairs"])
    return data["question"]


def normalize_question(text: str) -> str:
    text = text.lower()
    text = re.sub(r"[^a-z0-9\s]", "", text)
    return re.sub(r"\s+", " ", text).strip()


# ============================================================
# GENERATE + SAVE ONE QUESTION
# ============================================================

def generate_question(
    domain: str,
    chunk: Dict,
    learning_objective: Dict,
    retriever: SyllabusRetriever,
    qtype: str,
    model_name: str,
    top_k: int = 3,
) -> Dict:
    """Retrieve context, prompt the LLM, parse + validate the response.
    Returns the raw validated dict (shape depends on qtype) plus common
    metadata fields (learning_objective_id/text, cognitive_level,
    difficulty, source_section, retrieval_score)."""

    query = build_retrieval_query(chunk, learning_objective)
    retrieved = retriever.retrieve(query=query, domain=domain, top_k=top_k)
    if not retrieved:
        raise GenerationError("No relevant chunks were retrieved.")

    k_level = learning_objective["k"]
    prompt = PROMPTS_BY_TYPE[qtype].format(
        domain=domain,
        section_id=chunk["section_id"],
        section_title=chunk["section_title"],
        lo_id=learning_objective["id"],
        lo_text=learning_objective["text"],
        k_level=k_level,
        k_level_desc=K_LEVEL_DESC[k_level],
        retrieved_context=build_retrieved_context(retrieved),
    )

    raw_response = call_llm_json(prompt, model_name)
    cleaned = clean_llm_json(raw_response)

    try:
        data = json.loads(cleaned)
    except json.JSONDecodeError as exc:
        raise GenerationError(f"Groq returned invalid JSON: {exc}")

    valid, message = VALIDATORS_BY_TYPE[qtype](data)
    if not valid:
        raise GenerationError(f"Question validation failed: {message}")

    data["learning_objective_id"] = learning_objective["id"]
    data["learning_objective"] = learning_objective["text"]
    data["cognitive_level"] = k_level
    data["difficulty"] = K_TO_DIFFICULTY[k_level]
    data["source_section"] = f"{chunk['section_id']} {chunk['section_title']}"
    data["retrieval_score"] = round(retrieved[0][0], 4)
    return data


def save_generated_question(domain: Domain, data: Dict, qtype: str) -> Question:
    """Persist one validated generated question into Question + the
    right child table for its type."""

    if qtype in (Question.QuestionType.MCQ, Question.QuestionType.MULTI_SELECT):
        text = data["question"]
    elif qtype == Question.QuestionType.TRUE_FALSE:
        text = data["statement"]
    elif qtype == Question.QuestionType.FILL_BLANK:
        text = data["question"]
    else:  # matching
        text = data.get("instructions") or "Match each term to its correct description."

    question = Question.objects.create(
        domain=domain,
        text=text,
        difficulty=data["difficulty"],
        question_type=qtype,
        cognitive_level=data["cognitive_level"],
        learning_objective_id=data["learning_objective_id"],
        learning_objective=data["learning_objective"],
        source_section=data["source_section"],
    )

    if qtype == Question.QuestionType.MCQ:
        correct = data["correct_option"]
        AnswerOption.objects.bulk_create(
            AnswerOption(question=question, text=text_, is_correct=(letter == correct))
            for letter, text_ in data["options"].items()
        )
    elif qtype == Question.QuestionType.MULTI_SELECT:
        correct = set(data["correct_options"])
        AnswerOption.objects.bulk_create(
            AnswerOption(question=question, text=text_, is_correct=(letter in correct))
            for letter, text_ in data["options"].items()
        )
    elif qtype == Question.QuestionType.TRUE_FALSE:
        is_true = data["is_true"]
        AnswerOption.objects.bulk_create(
            [
                AnswerOption(question=question, text="True", is_correct=is_true),
                AnswerOption(question=question, text="False", is_correct=not is_true),
            ]
        )
    elif qtype == Question.QuestionType.FILL_BLANK:
        FillBlankAnswer.objects.bulk_create(
            FillBlankAnswer(question=question, answer_text=answer.strip())
            for answer in data["answers"]
        )
    else:  # matching
        MatchingPair.objects.bulk_create(
            MatchingPair(question=question, prompt_text=pair["prompt"].strip(), match_text=pair["match"].strip(), order=i)
            for i, pair in enumerate(data["pairs"])
        )

    return question


# ============================================================
# LEARNING OBJECTIVE SELECTION (per domain)
# ============================================================

def get_domain_learning_objectives(chunks: List[Dict], domain: str) -> List[Dict]:
    results, seen = [], set()
    for chunk in chunks:
        if chunk["domain"] != domain:
            continue
        for lo in chunk["learning_objectives"]:
            if lo["id"] in seen:
                continue
            results.append({"chunk": chunk, "learning_objective": lo})
            seen.add(lo["id"])
    return results


def choose_question_targets(domain_items: List[Dict], target: int) -> List[Dict]:
    """Rotate through K1/K2/K3 learning objectives fairly, cycling back
    through the available ones if there are fewer unique LOs than target."""
    if not domain_items:
        return []

    by_k = {"K1": [], "K2": [], "K3": []}
    for item in domain_items:
        k = item["learning_objective"]["k"]
        if k in by_k:
            by_k[k].append(item)

    selected, used = [], set()
    indices = {"K1": 0, "K2": 0, "K3": 0}
    while len(selected) < target:
        added = False
        for k in ("K1", "K2", "K3"):
            items = by_k[k]
            index = indices[k]
            if index >= len(items):
                continue
            item = items[index]
            indices[k] += 1
            lo_id = item["learning_objective"]["id"]
            if lo_id in used:
                continue
            used.add(lo_id)
            selected.append(item)
            added = True
            if len(selected) >= target:
                break
        if not added:
            break

    if len(selected) < target:
        index = 0
        while len(selected) < target:
            selected.append(domain_items[index % len(domain_items)])
            index += 1

    return selected[:target]


# ============================================================
# JOB ORCHESTRATION
# ============================================================

def _update_job(job: GenerationJob, **fields):
    for key, value in fields.items():
        setattr(job, key, value)
    job.save(update_fields=list(fields.keys()) + ["updated_at"])


def run_generation(job_id: int):
    """Entry point run on a background thread by
    questions.views.GenerationJobViewSet.create. Extracts the uploaded
    document, builds the RAG index, and generates+saves
    job.target_per_domain questions for each of the 6 domains, cycling
    through job.question_types. Never raises -- failures are recorded on
    the job row instead."""

    job = GenerationJob.objects.get(id=job_id)
    _update_job(job, status=GenerationJob.Status.PROCESSING)

    try:
        model_name = os.getenv("GENERATION_GROQ_MODEL", "openai/gpt-oss-120b")
        text = extract_document_text(job.source_file.path, job.source_filename)
        chapters = extract_chapters(text)
        chunks = build_all_chunks(chapters)
        retriever = SyllabusRetriever(chunks)

        question_types = [t for t in (job.question_types or []) if t in ALL_QUESTION_TYPES]
        if not question_types:
            question_types = [Question.QuestionType.MCQ]

        progress: Dict[str, Dict] = {}
        summary = {"created": 0, "domains": {}, "types": {}}

        for domain_name in DOMAIN_TITLES:
            domain_items = get_domain_learning_objectives(chunks, domain_name)
            if not domain_items:
                progress[domain_name] = {"generated": 0, "target": job.target_per_domain, "note": "no learning objectives found"}
                _update_job(job, progress=progress)
                continue

            targets = choose_question_targets(domain_items, job.target_per_domain)
            type_cycle = itertools.cycle(question_types)
            domain_obj, _ = Domain.objects.get_or_create(name=domain_name)

            generated = 0
            attempts = 0
            max_attempts = job.target_per_domain * 5
            seen_keys = set()

            while generated < job.target_per_domain and attempts < max_attempts:
                target_item = targets[generated % len(targets)]
                qtype = next(type_cycle)
                attempts += 1
                # Pace calls to stay under free-tier Groq's per-minute
                # request limit rather than hitting it on nearly every call.
                time.sleep(GENERATION_PACING_SECONDS)
                try:
                    generated_q = generate_question(
                        domain=domain_name,
                        chunk=target_item["chunk"],
                        learning_objective=target_item["learning_objective"],
                        retriever=retriever,
                        qtype=qtype,
                        model_name=model_name,
                    )
                    key = normalize_question(dedupe_key_text(generated_q, qtype))
                    if key in seen_keys:
                        continue
                    with transaction.atomic():
                        save_generated_question(domain_obj, generated_q, qtype)
                except Exception as exc:
                    logger.warning("Generation attempt failed for %s (%s): %s", domain_name, qtype, exc)
                    if is_unrecoverable_error(exc):
                        raise GenerationError(
                            f"Groq rejected the request, so generation was stopped early "
                            f"instead of retrying a call that cannot succeed: {exc}"
                        ) from exc
                    continue

                seen_keys.add(key)
                generated += 1
                summary["created"] += 1
                summary["domains"][domain_name] = summary["domains"].get(domain_name, 0) + 1
                summary["types"][qtype] = summary["types"].get(qtype, 0) + 1

            progress[domain_name] = {"generated": generated, "target": job.target_per_domain}
            _update_job(job, progress=progress)

        _update_job(job, status=GenerationJob.Status.COMPLETED, result_summary=summary)

    except Exception as exc:
        logger.exception("Generation job %s failed", job_id)
        _update_job(job, status=GenerationJob.Status.FAILED, error_message=str(exc))
