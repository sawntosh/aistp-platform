import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../apiClient", () => ({
  apiFetch: vi.fn(),
}));

import { apiFetch } from "../apiClient";
import { completeStudySession, fetchStudyDomains, fetchStudyTopics, startStudyTopic, submitStudyAnswer } from "../studyService";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("fetchStudyDomains", () => {
  it("GETs /study/domains/", async () => {
    apiFetch.mockResolvedValueOnce([]);
    await fetchStudyDomains();
    expect(apiFetch).toHaveBeenCalledWith("/study/domains/");
  });
});

describe("fetchStudyTopics", () => {
  it("GETs the topics for the given domain id", async () => {
    apiFetch.mockResolvedValueOnce([]);
    await fetchStudyTopics(3);
    expect(apiFetch).toHaveBeenCalledWith("/study/domains/3/topics/");
  });
});

describe("startStudyTopic", () => {
  it("POSTs to the topic's start endpoint", async () => {
    apiFetch.mockResolvedValueOnce({ session_id: 1 });
    await startStudyTopic(9);
    expect(apiFetch).toHaveBeenCalledWith("/study/topics/9/start/", { method: "POST" });
  });
});

describe("submitStudyAnswer", () => {
  it("merges the answer payload alongside question_id", async () => {
    apiFetch.mockResolvedValueOnce({ is_correct: true });
    await submitStudyAnswer(1, 5, { selected_option_id: 2 });
    expect(apiFetch).toHaveBeenCalledWith("/study/sessions/1/answer/", {
      method: "POST",
      body: JSON.stringify({ question_id: 5, selected_option_id: 2 }),
    });
  });
});

describe("completeStudySession", () => {
  it("POSTs to the session's complete endpoint", async () => {
    apiFetch.mockResolvedValueOnce({ completed: true });
    await completeStudySession(1);
    expect(apiFetch).toHaveBeenCalledWith("/study/sessions/1/complete/", { method: "POST" });
  });
});
