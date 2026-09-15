import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../apiClient", () => ({
  apiFetch: vi.fn(),
}));

import { apiFetch } from "../apiClient";
import { fetchExplanation } from "../explanationsService";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("fetchExplanation", () => {
  it("POSTs the question id to /explain/", async () => {
    apiFetch.mockResolvedValueOnce({ explanation: "Because...", is_fallback: false });

    const result = await fetchExplanation(17);

    expect(apiFetch).toHaveBeenCalledWith("/explain/", {
      method: "POST",
      body: JSON.stringify({ question_id: 17 }),
    });
    expect(result).toEqual({ explanation: "Because...", is_fallback: false });
  });

  it("propagates a rejection from apiFetch (e.g. a 404 for an unknown question)", async () => {
    const error = new Error("API error: 404");
    apiFetch.mockRejectedValueOnce(error);

    await expect(fetchExplanation(999)).rejects.toBe(error);
  });
});
