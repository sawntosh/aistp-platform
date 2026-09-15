import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../apiClient", () => ({
  apiFetch: vi.fn(),
}));

import { apiFetch } from "../apiClient";
import { certificatePdfUrl, claimCertificate, fetchMyCertificates } from "../certificatesService";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("fetchMyCertificates", () => {
  it("GETs /certificates/", async () => {
    apiFetch.mockResolvedValueOnce([]);
    const result = await fetchMyCertificates();
    expect(apiFetch).toHaveBeenCalledWith("/certificates/");
    expect(result).toEqual([]);
  });
});

describe("claimCertificate", () => {
  it("POSTs the session id to /certificates/claim/", async () => {
    apiFetch.mockResolvedValueOnce({ certificate_id: "AISTP-2026-ABCDEF" });
    const result = await claimCertificate({ sessionId: 42 });
    expect(apiFetch).toHaveBeenCalledWith("/certificates/claim/", {
      method: "POST",
      body: JSON.stringify({ session_id: 42 }),
    });
    expect(result).toEqual({ certificate_id: "AISTP-2026-ABCDEF" });
  });
});

describe("certificatePdfUrl", () => {
  const originalBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;

  afterEach(() => {
    process.env.NEXT_PUBLIC_API_BASE_URL = originalBaseUrl;
  });

  it("builds a plain PDF url with no query string by default", () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "http://api.test";
    expect(certificatePdfUrl("AISTP-2026-ABCDEF")).toBe("http://api.test/certificates/AISTP-2026-ABCDEF/pdf/");
  });

  it("appends ?download=1 when download is requested", () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "http://api.test";
    expect(certificatePdfUrl("AISTP-2026-ABCDEF", { download: true })).toBe(
      "http://api.test/certificates/AISTP-2026-ABCDEF/pdf/?download=1"
    );
  });

  it("URL-encodes the certificate id", () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "http://api.test";
    expect(certificatePdfUrl("AISTP 2026 ABC/DEF")).toBe(
      "http://api.test/certificates/AISTP%202026%20ABC%2FDEF/pdf/"
    );
  });

  it("falls back to an empty base when NEXT_PUBLIC_API_BASE_URL is unset", () => {
    delete process.env.NEXT_PUBLIC_API_BASE_URL;
    expect(certificatePdfUrl("AISTP-2026-ABCDEF")).toBe("/certificates/AISTP-2026-ABCDEF/pdf/");
  });
});
