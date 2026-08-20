import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { useAuth } from "../context/AuthContext";
import { getErrorMessage } from "../services/apiClient";
import {
  createQuestion,
  deleteQuestion,
  fetchAdminQuestions,
  fetchDomains,
  fetchGenerationJob,
  generateQuestionsFromFile,
  importQuestionsFile,
  updateQuestion,
} from "../services/questionsService";

const DIFFICULTIES = ["easy", "medium", "hard"];
const EMPTY_OPTION = { text: "", is_correct: false };
const EMPTY_BLANK_ANSWER = { answer_text: "" };
const EMPTY_MATCHING_PAIR = { prompt_text: "", match_text: "" };

const QUESTION_TYPES = [
  { value: "mcq", label: "Multiple choice" },
  { value: "true_false", label: "True / False" },
  { value: "multi_select", label: "Multiple answer" },
  { value: "fill_blank", label: "Fill in the blank" },
  { value: "matching", label: "Matching" },
];
const OPTION_BASED_TYPES = new Set(["mcq", "true_false", "multi_select"]);

function emptyForm(domainId) {
  return {
    id: null,
    domain: domainId ?? "",
    text: "",
    difficulty: "medium",
    question_type: "mcq",
    is_active: true,
    options: [{ ...EMPTY_OPTION }, { ...EMPTY_OPTION }],
    blank_answers: [{ ...EMPTY_BLANK_ANSWER }],
    matching_pairs: [{ ...EMPTY_MATCHING_PAIR }, { ...EMPTY_MATCHING_PAIR }],
  };
}

// Options reset to sensible defaults whenever the admin switches
// question_type in the form, since option shape/count rules differ per
// type (true_false is locked to exactly True/False).
function optionsForType(type, currentOptions) {
  if (type === "true_false") {
    const currentlyTrue = currentOptions.find((o) => o.text === "True")?.is_correct ?? true;
    return [
      { text: "True", is_correct: currentlyTrue },
      { text: "False", is_correct: !currentlyTrue },
    ];
  }
  if (currentOptions.some((o) => o.text === "True" || o.text === "False")) {
    return [{ ...EMPTY_OPTION }, { ...EMPTY_OPTION }];
  }
  return currentOptions;
}

export default function AdminPage() {
  const router = useRouter();
  const { user, isLoading: isAuthLoading } = useAuth();

  const [domains, setDomains] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [domainFilter, setDomainFilter] = useState("all");

  const [form, setForm] = useState(null); // null = form closed
  const [formError, setFormError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const [importFile, setImportFile] = useState(null);
  const [importResult, setImportResult] = useState(null);
  const [importErrors, setImportErrors] = useState(null);
  const [isImporting, setIsImporting] = useState(false);

  const [genFile, setGenFile] = useState(null);
  const [genTypes, setGenTypes] = useState(QUESTION_TYPES.map((t) => t.value));
  const [genTargetPerDomain, setGenTargetPerDomain] = useState(10);
  const [genJob, setGenJob] = useState(null);
  const [genError, setGenError] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    if (!isAuthLoading && (!user || user.role !== "admin")) {
      router.replace("/practice");
    }
  }, [isAuthLoading, user, router]);

  async function loadData() {
    setIsLoading(true);
    setLoadError("");
    try {
      const [domainList, questionList] = await Promise.all([fetchDomains(), fetchAdminQuestions()]);
      setDomains(domainList);
      setQuestions(questionList);
    } catch (err) {
      setLoadError(getErrorMessage(err, "Couldn't load questions right now."));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (user?.role === "admin") loadData();
  }, [user]);

  // Poll the generation job every 3s until it lands on completed/failed,
  // then refresh the question list once (self-rescheduling effect: each
  // successful poll sets a new genJob object, which re-triggers this).
  useEffect(() => {
    if (!genJob) return;
    if (genJob.status === "completed" || genJob.status === "failed") {
      setIsGenerating(false);
      if (genJob.status === "completed") loadData();
      return;
    }
    const timer = setTimeout(async () => {
      try {
        setGenJob(await fetchGenerationJob(genJob.id));
      } catch {
        // best-effort poll -- try again on the next tick
      }
    }, 3000);
    return () => clearTimeout(timer);
  }, [genJob]);

  const filteredQuestions = useMemo(() => {
    if (domainFilter === "all") return questions;
    return questions.filter((q) => String(q.domain) === String(domainFilter));
  }, [questions, domainFilter]);

  function domainName(id) {
    return domains.find((d) => d.id === id)?.name ?? `Domain #${id}`;
  }

  // -- Bulk JSON import --------------------------------------------------

  async function handleImport(e) {
    e.preventDefault();
    if (!importFile) return;
    setIsImporting(true);
    setImportResult(null);
    setImportErrors(null);
    try {
      const result = await importQuestionsFile(importFile);
      setImportResult(result);
      setImportFile(null);
      e.target.reset();
      loadData();
    } catch (err) {
      if (err.status === 400 && Array.isArray(err.body?.errors)) {
        setImportErrors(err.body.errors);
      } else {
        setImportErrors([{ row: null, error: getErrorMessage(err, "Import failed.") }]);
      }
    } finally {
      setIsImporting(false);
    }
  }

  // -- Generate from document (RAG) ---------------------------------------

  function toggleGenType(value) {
    setGenTypes((types) => (types.includes(value) ? types.filter((t) => t !== value) : [...types, value]));
  }

  async function handleGenerate(e) {
    e.preventDefault();
    if (!genFile || !genTypes.length) return;
    setGenError("");
    setIsGenerating(true);
    try {
      const job = await generateQuestionsFromFile(genFile, {
        questionTypes: genTypes,
        targetPerDomain: genTargetPerDomain,
      });
      setGenJob(job);
      setGenFile(null);
      e.target.reset();
    } catch (err) {
      setGenError(getErrorMessage(err, "Couldn't start generation."));
      setIsGenerating(false);
    }
  }

  // -- Manual create/edit form --------------------------------------------

  function openCreateForm() {
    setFormError("");
    setForm(emptyForm(domains[0]?.id));
  }

  function openEditForm(question) {
    setFormError("");
    setForm({
      id: question.id,
      domain: question.domain,
      text: question.text,
      difficulty: question.difficulty,
      question_type: question.question_type || "mcq",
      is_active: question.is_active,
      options: question.options?.length
        ? question.options.map((o) => ({ text: o.text, is_correct: o.is_correct }))
        : [{ ...EMPTY_OPTION }, { ...EMPTY_OPTION }],
      blank_answers: question.blank_answers?.length
        ? question.blank_answers.map((b) => ({ answer_text: b.answer_text }))
        : [{ ...EMPTY_BLANK_ANSWER }],
      matching_pairs: question.matching_pairs?.length
        ? question.matching_pairs.map((m) => ({ prompt_text: m.prompt_text, match_text: m.match_text }))
        : [{ ...EMPTY_MATCHING_PAIR }, { ...EMPTY_MATCHING_PAIR }],
    });
  }

  function closeForm() {
    setForm(null);
    setFormError("");
  }

  function setQuestionType(type) {
    setForm((f) => ({ ...f, question_type: type, options: optionsForType(type, f.options) }));
  }

  function updateOption(index, patch) {
    setForm((f) => ({
      ...f,
      options: f.options.map((o, i) => (i === index ? { ...o, ...patch } : o)),
    }));
  }

  function setCorrectOption(index) {
    setForm((f) => ({
      ...f,
      options: f.options.map((o, i) => ({ ...o, is_correct: i === index })),
    }));
  }

  function toggleCorrectOption(index) {
    setForm((f) => ({
      ...f,
      options: f.options.map((o, i) => (i === index ? { ...o, is_correct: !o.is_correct } : o)),
    }));
  }

  function addOption() {
    setForm((f) => (f.options.length >= 4 ? f : { ...f, options: [...f.options, { ...EMPTY_OPTION }] }));
  }

  function removeOption(index) {
    setForm((f) => (f.options.length <= 2 ? f : { ...f, options: f.options.filter((_, i) => i !== index) }));
  }

  function updateBlankAnswer(index, text) {
    setForm((f) => ({
      ...f,
      blank_answers: f.blank_answers.map((b, i) => (i === index ? { answer_text: text } : b)),
    }));
  }

  function addBlankAnswer() {
    setForm((f) => ({ ...f, blank_answers: [...f.blank_answers, { ...EMPTY_BLANK_ANSWER }] }));
  }

  function removeBlankAnswer(index) {
    setForm((f) => (f.blank_answers.length <= 1 ? f : { ...f, blank_answers: f.blank_answers.filter((_, i) => i !== index) }));
  }

  function updateMatchingPair(index, patch) {
    setForm((f) => ({
      ...f,
      matching_pairs: f.matching_pairs.map((p, i) => (i === index ? { ...p, ...patch } : p)),
    }));
  }

  function addMatchingPair() {
    setForm((f) => (f.matching_pairs.length >= 5 ? f : { ...f, matching_pairs: [...f.matching_pairs, { ...EMPTY_MATCHING_PAIR }] }));
  }

  function removeMatchingPair(index) {
    setForm((f) =>
      f.matching_pairs.length <= 2 ? f : { ...f, matching_pairs: f.matching_pairs.filter((_, i) => i !== index) }
    );
  }

  async function handleSaveForm(e) {
    e.preventDefault();
    setFormError("");

    const payload = {
      domain: Number(form.domain),
      text: form.text,
      difficulty: form.difficulty,
      question_type: form.question_type,
      is_active: form.is_active,
    };

    if (OPTION_BASED_TYPES.has(form.question_type)) {
      const correctCount = form.options.filter((o) => o.is_correct).length;
      if (form.question_type === "multi_select" ? correctCount < 2 : correctCount !== 1) {
        setFormError(
          form.question_type === "multi_select"
            ? "Select at least 2 correct options."
            : "Select which option is correct."
        );
        return;
      }
      payload.options = form.options.map((o) => ({ text: o.text, is_correct: o.is_correct }));
    } else if (form.question_type === "fill_blank") {
      if (!form.blank_answers.some((b) => b.answer_text.trim())) {
        setFormError("Add at least 1 accepted answer.");
        return;
      }
      payload.blank_answers = form.blank_answers.filter((b) => b.answer_text.trim());
    } else if (form.question_type === "matching") {
      if (form.matching_pairs.some((p) => !p.prompt_text.trim() || !p.match_text.trim())) {
        setFormError("Fill in every prompt and match.");
        return;
      }
      payload.matching_pairs = form.matching_pairs;
    }

    setIsSaving(true);
    try {
      if (form.id) {
        await updateQuestion(form.id, payload);
      } else {
        await createQuestion(payload);
      }
      closeForm();
      loadData();
    } catch (err) {
      setFormError(getErrorMessage(err, "Couldn't save this question."));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(question) {
    if (!window.confirm("Delete this question? This can't be undone.")) return;
    try {
      await deleteQuestion(question.id);
      setQuestions((qs) => qs.filter((q) => q.id !== question.id));
    } catch (err) {
      window.alert(getErrorMessage(err, "Couldn't delete this question."));
    }
  }

  if (isAuthLoading || !user || user.role !== "admin") return null;

  return (
    <div className="min-h-[calc(100vh-49px)] bg-gray-50 px-4 py-8 sm:px-8">
      <div className="mx-auto max-w-5xl space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Question Bank</h1>
          <p className="text-sm text-gray-500">
            Generate questions from a document, import from JSON, or manage them one at a time.
          </p>
        </div>

        {/* Generate from document (RAG) */}
        <section className="rounded-xl bg-white p-6 shadow">
          <h2 className="text-lg font-semibold text-gray-900">Generate from document</h2>
          <p className="mt-1 text-sm text-gray-500">
            Upload the ISTQB Content as a PDF or DOCX. Groq retrieves the relevant syllabus context
            for each learning objective and writes new questions straight into the question bank.
          </p>
          <form onSubmit={handleGenerate} className="mt-4 space-y-4">
            <div className="flex flex-wrap items-center gap-4">
              <input
                type="file"
                accept=".pdf,.docx"
                onChange={(e) => setGenFile(e.target.files?.[0] ?? null)}
                className="text-sm text-gray-700 file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-indigo-700 hover:file:bg-indigo-100"
              />
              <label className="flex items-center gap-2 text-sm text-gray-700">
                Questions per domain
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={genTargetPerDomain}
                  onChange={(e) => setGenTargetPerDomain(Number(e.target.value))}
                  className="w-20 rounded-lg border border-gray-200 px-2 py-1 text-sm"
                />
              </label>
            </div>

            <div>
              <p className="mb-2 text-sm font-medium text-gray-700">Question types to generate</p>
              <div className="flex flex-wrap gap-4">
                {QUESTION_TYPES.map((type) => (
                  <label key={type.value} className="flex items-center gap-1.5 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={genTypes.includes(type.value)}
                      onChange={() => toggleGenType(type.value)}
                    />
                    {type.label}
                  </label>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={!genFile || !genTypes.length || isGenerating}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {isGenerating ? "Generating…" : "Generate questions"}
            </button>
          </form>

          {genError && <p className="mt-4 text-sm text-red-600">{genError}</p>}

          {genJob && (
            <div className="mt-4 rounded-lg bg-gray-50 px-4 py-3 text-sm">
              <p className="font-medium text-gray-900">
                {genJob.status === "pending" && "Queued…"}
                {genJob.status === "processing" && "Generating questions…"}
                {genJob.status === "completed" &&
                  `Done — ${genJob.result_summary?.created ?? 0} question(s) created.`}
                {genJob.status === "failed" && "Generation failed."}
              </p>
              {genJob.status === "failed" && genJob.error_message && (
                <p className="mt-1 text-red-700">{genJob.error_message}</p>
              )}
              {Object.keys(genJob.progress ?? {}).length > 0 && (
                <ul className="mt-2 space-y-1 text-gray-600">
                  {Object.entries(genJob.progress).map(([domain, info]) => (
                    <li key={domain}>
                      {domain}: {info.generated}/{info.target}
                      {info.note ? ` (${info.note})` : ""}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </section>

        {/* Bulk JSON import */}
        <section className="rounded-xl bg-white p-6 shadow">
          <h2 className="text-lg font-semibold text-gray-900">Import from JSON</h2>
          <p className="mt-1 text-sm text-gray-500">
            Upload a JSON file containing an array of questions (Domain, Difficulty, Question Text, Option
            A-D, Correct Option, ...). Domains are matched by name and created automatically if new.
          </p>
          <form onSubmit={handleImport} className="mt-4 flex flex-wrap items-center gap-3">
            <input
              type="file"
              accept="application/json"
              onChange={(e) => setImportFile(e.target.files?.[0] ?? null)}
              className="text-sm text-gray-700 file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-indigo-700 hover:file:bg-indigo-100"
            />
            <button
              type="submit"
              disabled={!importFile || isImporting}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {isImporting ? "Importing…" : "Upload"}
            </button>
          </form>

          {importResult && (
            <div className="mt-4 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-800">
              <p className="font-medium">
                Imported {importResult.created} question{importResult.created === 1 ? "" : "s"}.
              </p>
              {Object.entries(importResult.domains ?? {}).map(([name, count]) => (
                <p key={name} className="text-green-700">
                  {name}: {count}
                </p>
              ))}
            </div>
          )}

          {importErrors && (
            <div className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800">
              <p className="font-medium">Import rejected — fix these rows and re-upload:</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {importErrors.map((e, i) => (
                  <li key={i}>
                    {e.row !== null && e.row !== undefined ? `Row ${e.row + 1}: ` : ""}
                    {e.error}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        {/* Manage questions */}
        <section className="rounded-xl bg-white p-6 shadow">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-gray-900">Questions ({filteredQuestions.length})</h2>
            <div className="flex items-center gap-3">
              <select
                value={domainFilter}
                onChange={(e) => setDomainFilter(e.target.value)}
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
              >
                <option value="all">All domains</option>
                {domains.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={openCreateForm}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
              >
                + New Question
              </button>
            </div>
          </div>

          {loadError && <p className="mt-4 text-sm text-red-600">{loadError}</p>}

          {isLoading ? (
            <p className="mt-4 text-sm text-gray-500">Loading…</p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-gray-500">
                    <th className="py-2 pr-4">Question</th>
                    <th className="py-2 pr-4">Domain</th>
                    <th className="py-2 pr-4">Type</th>
                    <th className="py-2 pr-4">Difficulty</th>
                    <th className="py-2 pr-4">Active</th>
                    <th className="py-2" />
                  </tr>
                </thead>
                <tbody>
                  {filteredQuestions.map((q) => (
                    <tr key={q.id} className="border-b border-gray-100">
                      <td className="max-w-md truncate py-2 pr-4 text-gray-900">{q.text}</td>
                      <td className="py-2 pr-4 text-gray-600">{domainName(q.domain)}</td>
                      <td className="py-2 pr-4 text-gray-600">
                        {QUESTION_TYPES.find((t) => t.value === q.question_type)?.label ?? q.question_type}
                      </td>
                      <td className="py-2 pr-4 capitalize text-gray-600">{q.difficulty}</td>
                      <td className="py-2 pr-4 text-gray-600">{q.is_active ? "Yes" : "No"}</td>
                      <td className="py-2 text-right">
                        <button
                          type="button"
                          onClick={() => openEditForm(q)}
                          className="mr-3 text-indigo-600 hover:underline"
                        >
                          Edit
                        </button>
                        <button type="button" onClick={() => handleDelete(q)} className="text-red-600 hover:underline">
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                  {!filteredQuestions.length && (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-gray-400">
                        No questions yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Create/edit form */}
        {form && (
          <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/30 px-4">
            <form
              onSubmit={handleSaveForm}
              className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-xl"
            >
              <h2 className="text-lg font-semibold text-gray-900">{form.id ? "Edit question" : "New question"}</h2>

              <label className="mt-4 block text-sm font-medium text-gray-700">Domain</label>
              <select
                required
                value={form.domain}
                onChange={(e) => setForm({ ...form, domain: e.target.value })}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              >
                <option value="" disabled>
                  Select a domain
                </option>
                {domains.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>

              <label className="mt-4 block text-sm font-medium text-gray-700">Question text</label>
              <textarea
                required
                rows={3}
                value={form.text}
                onChange={(e) => setForm({ ...form, text: e.target.value })}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              />

              <label className="mt-4 block text-sm font-medium text-gray-700">Difficulty</label>
              <select
                value={form.difficulty}
                onChange={(e) => setForm({ ...form, difficulty: e.target.value })}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm capitalize"
              >
                {DIFFICULTIES.map((d) => (
                  <option key={d} value={d} className="capitalize">
                    {d}
                  </option>
                ))}
              </select>

              <label className="mt-4 block text-sm font-medium text-gray-700">Question type</label>
              <select
                value={form.question_type}
                onChange={(e) => setQuestionType(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              >
                {QUESTION_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>

              {OPTION_BASED_TYPES.has(form.question_type) && (
                <div className="mt-4">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-gray-700">Answer options</label>
                    {form.question_type !== "true_false" && form.options.length < 4 && (
                      <button type="button" onClick={addOption} className="text-xs font-medium text-indigo-600 hover:underline">
                        + Add option
                      </button>
                    )}
                  </div>
                  <div className="mt-2 space-y-2">
                    {form.options.map((option, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <input
                          type={form.question_type === "multi_select" ? "checkbox" : "radio"}
                          name="correct-option"
                          checked={option.is_correct}
                          onChange={() =>
                            form.question_type === "multi_select" ? toggleCorrectOption(index) : setCorrectOption(index)
                          }
                          title="Mark as correct"
                        />
                        <input
                          required
                          type="text"
                          readOnly={form.question_type === "true_false"}
                          placeholder={`Option ${index + 1}`}
                          value={option.text}
                          onChange={(e) => updateOption(index, { text: e.target.value })}
                          className={`flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm ${
                            form.question_type === "true_false" ? "bg-gray-50 text-gray-500" : ""
                          }`}
                        />
                        {form.question_type !== "true_false" && form.options.length > 2 && (
                          <button
                            type="button"
                            onClick={() => removeOption(index)}
                            className="text-gray-400 hover:text-red-600"
                            aria-label="Remove option"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  <p className="mt-1 text-xs text-gray-400">
                    {form.question_type === "multi_select"
                      ? "Check every option that's correct (at least 2)."
                      : "Select the radio button next to the correct option."}
                  </p>
                </div>
              )}

              {form.question_type === "fill_blank" && (
                <div className="mt-4">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-gray-700">Accepted answers</label>
                    <button type="button" onClick={addBlankAnswer} className="text-xs font-medium text-indigo-600 hover:underline">
                      + Add answer
                    </button>
                  </div>
                  <p className="mt-1 text-xs text-gray-400">
                    Write the blank in the question text as &quot;_____&quot;. List every phrasing that should count as correct.
                  </p>
                  <div className="mt-2 space-y-2">
                    {form.blank_answers.map((answer, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <input
                          required
                          type="text"
                          placeholder={`Accepted answer ${index + 1}`}
                          value={answer.answer_text}
                          onChange={(e) => updateBlankAnswer(index, e.target.value)}
                          className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm"
                        />
                        {form.blank_answers.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeBlankAnswer(index)}
                            className="text-gray-400 hover:text-red-600"
                            aria-label="Remove answer"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {form.question_type === "matching" && (
                <div className="mt-4">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-gray-700">Matching pairs</label>
                    {form.matching_pairs.length < 5 && (
                      <button type="button" onClick={addMatchingPair} className="text-xs font-medium text-indigo-600 hover:underline">
                        + Add pair
                      </button>
                    )}
                  </div>
                  <div className="mt-2 space-y-2">
                    {form.matching_pairs.map((pair, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <input
                          required
                          type="text"
                          placeholder="Prompt"
                          value={pair.prompt_text}
                          onChange={(e) => updateMatchingPair(index, { prompt_text: e.target.value })}
                          className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm"
                        />
                        <input
                          required
                          type="text"
                          placeholder="Match"
                          value={pair.match_text}
                          onChange={(e) => updateMatchingPair(index, { match_text: e.target.value })}
                          className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm"
                        />
                        {form.matching_pairs.length > 2 && (
                          <button
                            type="button"
                            onClick={() => removeMatchingPair(index)}
                            className="text-gray-400 hover:text-red-600"
                            aria-label="Remove pair"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <label className="mt-4 flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                />
                Active (visible to learners)
              </label>

              {formError && <p className="mt-3 text-sm text-red-600">{formError}</p>}

              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={closeForm}
                  className="rounded-lg px-4 py-2 text-sm text-gray-600 hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {isSaving ? "Saving…" : "Save"}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
