import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../apiClient", () => ({
  apiFetch: vi.fn(),
}));

import { apiFetch } from "../apiClient";
import {
  createQuestion,
  deleteQuestion,
  deleteQuestionImage,
  discardSession,
  fetchAdminQuestions,
  fetchDomains,
  fetchGenerationJob,
  fetchPracticeQuestions,
  fetchResumableSessions,
  fetchResumeSession,
  fetchSessionReview,
  finishSession,
  generateQuestionsFromFile,
  importQuestionsFile,
  submitAnswer,
  updateQuestion,
  uploadQuestionImage,
} from "../questionsService";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("fetchPracticeQuestions", () => {
  it("defaults to count=10, mode=practice, and no domains param", async () => {
    apiFetch.mockResolvedValueOnce([]);
    await fetchPracticeQuestions();
    expect(apiFetch).toHaveBeenCalledWith("/questions/?count=10&mode=practice");
  });

  it("includes a comma-joined domains param when domains are given", async () => {
    apiFetch.mockResolvedValueOnce([]);
    await fetchPracticeQuestions(20, [1, 2, 3], "test");
    expect(apiFetch).toHaveBeenCalledWith("/questions/?count=20&mode=test&domains=1%2C2%2C3");
  });
});

describe("submitAnswer", () => {
  it("merges the answer payload alongside session_id and question_id", async () => {
    apiFetch.mockResolvedValueOnce({ is_correct: true });
    await submitAnswer({ sessionId: 5, questionId: 9, answer: { selected_option_id: 3 } });
    expect(apiFetch).toHaveBeenCalledWith("/questions/submit/", {
      method: "POST",
      body: JSON.stringify({ session_id: 5, question_id: 9, selected_option_id: 3 }),
    });
  });
});

describe("finishSession", () => {
  it("POSTs to the session's finish endpoint", async () => {
    apiFetch.mockResolvedValueOnce({ score: 8 });
    await finishSession(5);
    expect(apiFetch).toHaveBeenCalledWith("/questions/sessions/5/finish/", { method: "POST" });
  });
});

describe("fetchSessionReview", () => {
  it("omits the query string when no questionIds are given", async () => {
    apiFetch.mockResolvedValueOnce([]);
    await fetchSessionReview(5);
    expect(apiFetch).toHaveBeenCalledWith("/questions/sessions/5/review/");
  });

  it("includes a comma-joined questions param when given", async () => {
    apiFetch.mockResolvedValueOnce([]);
    await fetchSessionReview(5, [11, 12, 13]);
    expect(apiFetch).toHaveBeenCalledWith("/questions/sessions/5/review/?questions=11,12,13");
  });
});

describe("resumable sessions", () => {
  it("fetchResumableSessions GETs the resumable list", async () => {
    apiFetch.mockResolvedValueOnce([]);
    await fetchResumableSessions();
    expect(apiFetch).toHaveBeenCalledWith("/questions/sessions/resumable/");
  });

  it("fetchResumeSession GETs the single session's resume payload", async () => {
    apiFetch.mockResolvedValueOnce({});
    await fetchResumeSession(7);
    expect(apiFetch).toHaveBeenCalledWith("/questions/sessions/7/resume/");
  });

  it("discardSession DELETEs the session", async () => {
    apiFetch.mockResolvedValueOnce({});
    await discardSession(7);
    expect(apiFetch).toHaveBeenCalledWith("/questions/sessions/7/resume/", { method: "DELETE" });
  });
});

describe("fetchDomains", () => {
  it("GETs /questions/domains/", async () => {
    apiFetch.mockResolvedValueOnce([]);
    await fetchDomains();
    expect(apiFetch).toHaveBeenCalledWith("/questions/domains/");
  });
});

describe("fetchAdminQuestions", () => {
  it("defaults to page=1, page_size=25, and no domain filter", async () => {
    apiFetch.mockResolvedValueOnce({ count: 0, results: [] });
    await fetchAdminQuestions();
    expect(apiFetch).toHaveBeenCalledWith("/questions/admin/questions/?page=1&page_size=25");
  });

  it("includes the domain filter when a specific domain id is given", async () => {
    apiFetch.mockResolvedValueOnce({ count: 0, results: [] });
    await fetchAdminQuestions({ page: 2, pageSize: 50, domain: 3 });
    expect(apiFetch).toHaveBeenCalledWith("/questions/admin/questions/?page=2&page_size=50&domain=3");
  });

  it("omits the domain filter when domain is 'all'", async () => {
    apiFetch.mockResolvedValueOnce({ count: 0, results: [] });
    await fetchAdminQuestions({ domain: "all" });
    expect(apiFetch).toHaveBeenCalledWith("/questions/admin/questions/?page=1&page_size=25");
  });
});

describe("admin question CRUD", () => {
  it("createQuestion POSTs the payload", async () => {
    const payload = { text: "2+2?", question_type: "mcq" };
    apiFetch.mockResolvedValueOnce({ id: 1, ...payload });
    await createQuestion(payload);
    expect(apiFetch).toHaveBeenCalledWith("/questions/admin/questions/", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  });

  it("updateQuestion PUTs the payload to the question's id", async () => {
    const payload = { text: "Updated?" };
    apiFetch.mockResolvedValueOnce({ id: 1, ...payload });
    await updateQuestion(1, payload);
    expect(apiFetch).toHaveBeenCalledWith("/questions/admin/questions/1/", {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  });

  it("deleteQuestion DELETEs the question's id", async () => {
    apiFetch.mockResolvedValueOnce({});
    await deleteQuestion(1);
    expect(apiFetch).toHaveBeenCalledWith("/questions/admin/questions/1/", { method: "DELETE" });
  });
});

describe("uploadQuestionImage / deleteQuestionImage", () => {
  it("uploadQuestionImage POSTs a FormData body containing the file under 'image'", async () => {
    apiFetch.mockResolvedValueOnce({ id: 1 });
    const file = new File(["binary"], "diagram.png", { type: "image/png" });

    await uploadQuestionImage(1, file);

    expect(apiFetch).toHaveBeenCalledTimes(1);
    const [path, options] = apiFetch.mock.calls[0];
    expect(path).toBe("/questions/admin/questions/1/image/");
    expect(options.method).toBe("POST");
    expect(options.body).toBeInstanceOf(FormData);
    expect(options.body.get("image")).toBe(file);
  });

  it("deleteQuestionImage DELETEs the image endpoint", async () => {
    apiFetch.mockResolvedValueOnce({});
    await deleteQuestionImage(1);
    expect(apiFetch).toHaveBeenCalledWith("/questions/admin/questions/1/image/", { method: "DELETE" });
  });
});

describe("importQuestionsFile", () => {
  it("sends the file as FormData without a domain_id when none is given", async () => {
    apiFetch.mockResolvedValueOnce({ imported: 10 });
    const file = new File(["[]"], "questions.json", { type: "application/json" });

    await importQuestionsFile(file);

    const [path, options] = apiFetch.mock.calls[0];
    expect(path).toBe("/questions/admin/questions/import/");
    expect(options.body.get("file")).toBe(file);
    expect(options.body.get("domain_id")).toBeNull();
  });

  it("includes domain_id in the FormData when given", async () => {
    apiFetch.mockResolvedValueOnce({ imported: 10 });
    const file = new File(["[]"], "questions.json", { type: "application/json" });

    await importQuestionsFile(file, 4);

    const [, options] = apiFetch.mock.calls[0];
    expect(options.body.get("domain_id")).toBe("4");
  });
});

describe("generateQuestionsFromFile", () => {
  it("builds FormData with the file, target_per_domain, and repeated question_types/domains entries", async () => {
    apiFetch.mockResolvedValueOnce({ job_id: "abc" });
    const file = new File(["binary"], "syllabus.pdf", { type: "application/pdf" });

    await generateQuestionsFromFile(file, {
      questionTypes: ["mcq", "true_false"],
      domains: ["Domain 1", "Domain 2"],
      targetPerDomain: 15,
    });

    const [path, options] = apiFetch.mock.calls[0];
    expect(path).toBe("/questions/admin/generate/");
    expect(options.method).toBe("POST");
    expect(options.body.get("file")).toBe(file);
    expect(options.body.get("target_per_domain")).toBe("15");
    expect(options.body.getAll("question_types")).toEqual(["mcq", "true_false"]);
    expect(options.body.getAll("domains")).toEqual(["Domain 1", "Domain 2"]);
  });

  it("defaults target_per_domain to 10 with no question types/domains appended", async () => {
    apiFetch.mockResolvedValueOnce({ job_id: "abc" });
    const file = new File(["binary"], "syllabus.pdf", { type: "application/pdf" });

    await generateQuestionsFromFile(file);

    const [, options] = apiFetch.mock.calls[0];
    expect(options.body.get("target_per_domain")).toBe("10");
    expect(options.body.getAll("question_types")).toEqual([]);
    expect(options.body.getAll("domains")).toEqual([]);
  });
});

describe("fetchGenerationJob", () => {
  it("GETs the job by id", async () => {
    apiFetch.mockResolvedValueOnce({ status: "running" });
    await fetchGenerationJob("job-1");
    expect(apiFetch).toHaveBeenCalledWith("/questions/admin/generate/job-1/");
  });
});
