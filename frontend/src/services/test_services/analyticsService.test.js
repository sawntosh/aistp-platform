import { describe, expect, it, vi } from "vitest";

vi.mock("../apiClient", () => ({
  apiFetch: vi.fn(),
}));

import { apiFetch } from "../apiClient";
import { fetchDashboardAnalytics } from "../analyticsService";

describe("fetchDashboardAnalytics", () => {
  it("GETs /analytics/dashboard/ and returns the response body unchanged", async () => {
    const payload = { overall_accuracy: 82.5, domains: [], sessions: [] };
    apiFetch.mockResolvedValueOnce(payload);

    const result = await fetchDashboardAnalytics();

    expect(apiFetch).toHaveBeenCalledWith("/analytics/dashboard/");
    expect(apiFetch).toHaveBeenCalledTimes(1);
    expect(result).toBe(payload);
  });

  it("propagates a rejection from apiFetch", async () => {
    const error = new Error("API error: 500");
    apiFetch.mockRejectedValueOnce(error);

    await expect(fetchDashboardAnalytics()).rejects.toBe(error);
  });
});
