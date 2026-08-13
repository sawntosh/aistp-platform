import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { useAuth } from "../context/AuthContext";
import { getErrorMessage } from "../services/apiClient";
import {
  createQuestion,
  deleteQuestion,
  fetchAdminQuestions,
  fetchDomains,
  importQuestionsFile,
  updateQuestion,
} from "../services/questionsService";

const DIFFICULTIES = ["easy", "medium", "hard"];
const EMPTY_OPTION = { text: "", is_correct: false };

function emptyForm(domainId) {
  return {
    id: null,
    domain: domainId ?? "",
    text: "",
    difficulty: "medium",
    is_active: true,
    options: [{ ...EMPTY_OPTION }, { ...EMPTY_OPTION }],
  };
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
      is_active: question.is_active,
      options: question.options.map((o) => ({ text: o.text, is_correct: o.is_correct })),
    });
  }

  function closeForm() {
    setForm(null);
    setFormError("");
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

  function addOption() {
    setForm((f) => (f.options.length >= 4 ? f : { ...f, options: [...f.options, { ...EMPTY_OPTION }] }));
  }

  function removeOption(index) {
    setForm((f) => (f.options.length <= 2 ? f : { ...f, options: f.options.filter((_, i) => i !== index) }));
  }

  async function handleSaveForm(e) {
    e.preventDefault();
    setFormError("");

    if (!form.options.some((o) => o.is_correct)) {
      setFormError("Select which option is correct.");
      return;
    }

    setIsSaving(true);
    const payload = {
      domain: Number(form.domain),
      text: form.text,
      difficulty: form.difficulty,
      is_active: form.is_active,
      options: form.options.map((o) => ({ text: o.text, is_correct: o.is_correct })),
    };
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
          <p className="text-sm text-gray-500">Import questions from JSON or manage them one at a time.</p>
        </div>

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
                      <td colSpan={5} className="py-6 text-center text-gray-400">
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

              <div className="mt-4">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-gray-700">Answer options</label>
                  {form.options.length < 4 && (
                    <button type="button" onClick={addOption} className="text-xs font-medium text-indigo-600 hover:underline">
                      + Add option
                    </button>
                  )}
                </div>
                <div className="mt-2 space-y-2">
                  {form.options.map((option, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="correct-option"
                        checked={option.is_correct}
                        onChange={() => setCorrectOption(index)}
                        title="Mark as correct"
                      />
                      <input
                        required
                        type="text"
                        placeholder={`Option ${index + 1}`}
                        value={option.text}
                        onChange={(e) => updateOption(index, { text: e.target.value })}
                        className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm"
                      />
                      {form.options.length > 2 && (
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
                <p className="mt-1 text-xs text-gray-400">Select the radio button next to the correct option.</p>
              </div>

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
