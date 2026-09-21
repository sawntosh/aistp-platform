// @vitest-environment jsdom
//
// Unit tests for apiClient.js -- the central fetch wrapper (token storage,
// the 401-triggers-refresh-then-retry flow, and DRF error-body flattening).
//
// NEXT_PUBLIC_API_BASE_URL is read into a module-level const at import
// time, so most tests load a fresh copy of the module via a dynamic
// import (after setting process.env and calling vi.resetModules()) rather
// than a single static top-of-file import. This also gives every test a
// clean slate for the module's other internal state (in-memory token,
// in-flight refresh promise).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const API_BASE_URL = "http://api.test";

function jsonResponse(status, body, { ok = status < 400 } = {}) {
  return {
    ok,
    status,
    headers: { get: () => "application/json" },
    json: async () => body,
  };
}

function emptyResponse(status, { ok = status < 400 } = {}) {
  return {
    ok,
    status,
    headers: { get: () => "text/plain" },
    json: async () => {
      throw new Error("should not be called for a non-JSON response");
    },
  };
}

async function loadApiClient(options = {}) {
  vi.resetModules();
  // Distinguish "baseUrl key explicitly passed as undefined" (used to test
  // the missing-env-var guard) from "key omitted" (use the normal default) --
  // a plain destructuring default can't tell those apart, since it treats
  // an explicit `undefined` the same as "not provided".
  const baseUrl = "baseUrl" in options ? options.baseUrl : API_BASE_URL;
  if (baseUrl === undefined) {
    delete process.env.NEXT_PUBLIC_API_BASE_URL;
  } else {
    process.env.NEXT_PUBLIC_API_BASE_URL = baseUrl;
  }
  return import("../apiClient");
}

beforeEach(() => {
  window.localStorage.clear();
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("apiFetch -- base URL guard", () => {
  it("throws a clear error and never calls fetch when NEXT_PUBLIC_API_BASE_URL is unset", async () => {
    const { apiFetch } = await loadApiClient({ baseUrl: undefined });

    await expect(apiFetch("/questions/")).rejects.toThrow(/NEXT_PUBLIC_API_BASE_URL is not set/);
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("apiFetch -- request construction", () => {
  it("hits API_BASE_URL + path and resolves with the parsed JSON body on success", async () => {
    const { apiFetch } = await loadApiClient();
    fetch.mockResolvedValueOnce(jsonResponse(200, { ok: true }));

    const result = await apiFetch("/questions/");

    expect(fetch).toHaveBeenCalledWith(`${API_BASE_URL}/questions/`, expect.any(Object));
    expect(result).toEqual({ ok: true });
  });

  it("returns null when the response has no JSON content-type", async () => {
    const { apiFetch } = await loadApiClient();
    fetch.mockResolvedValueOnce(emptyResponse(204));

    const result = await apiFetch("/questions/submit/", { method: "POST" });

    expect(result).toBeNull();
  });

  it("sends Content-Type: application/json for a plain object body", async () => {
    const { apiFetch } = await loadApiClient();
    fetch.mockResolvedValueOnce(jsonResponse(200, {}));

    await apiFetch("/auth/login/", { method: "POST", body: JSON.stringify({ username: "a" }) });

    const [, options] = fetch.mock.calls[0];
    expect(options.headers["Content-Type"]).toBe("application/json");
  });

  it("omits Content-Type for a FormData body so the browser can set its own boundary", async () => {
    const { apiFetch } = await loadApiClient();
    fetch.mockResolvedValueOnce(jsonResponse(200, {}));

    const formData = new FormData();
    formData.append("file", new Blob(["x"]), "x.json");
    await apiFetch("/questions/admin/questions/import/", { method: "POST", body: formData });

    const [, options] = fetch.mock.calls[0];
    expect(options.headers["Content-Type"]).toBeUndefined();
  });

  it("does not attach an Authorization header when no token has been set", async () => {
    const { apiFetch } = await loadApiClient();
    fetch.mockResolvedValueOnce(jsonResponse(200, {}));

    await apiFetch("/questions/");

    const [, options] = fetch.mock.calls[0];
    expect(options.headers.Authorization).toBeUndefined();
  });

  it("attaches Authorization: Bearer <token> once setToken has been called", async () => {
    const { apiFetch, setToken } = await loadApiClient();
    setToken("abc123");
    fetch.mockResolvedValueOnce(jsonResponse(200, {}));

    await apiFetch("/questions/");

    const [, options] = fetch.mock.calls[0];
    expect(options.headers.Authorization).toBe("Bearer abc123");
  });
});

describe("apiFetch -- non-401 errors", () => {
  it("throws an Error carrying .status and .body, without attempting a refresh", async () => {
    const { apiFetch } = await loadApiClient();
    fetch.mockResolvedValueOnce(jsonResponse(400, { username: ["Already taken"] }));

    const error = await apiFetch("/auth/register/", { method: "POST" }).catch((e) => e);

    expect(error).toBeInstanceOf(Error);
    expect(error.status).toBe(400);
    expect(error.body).toEqual({ username: ["Already taken"] });
    expect(fetch).toHaveBeenCalledTimes(1); // no refresh attempt
  });
});

describe("apiFetch -- 401 on a NO_REFRESH_PATHS endpoint", () => {
  it("does not attempt a refresh for /auth/login/, /auth/register/ or /auth/refresh/", async () => {
    const { apiFetch } = await loadApiClient();
    fetch.mockResolvedValueOnce(jsonResponse(401, { detail: "Invalid credentials" }));

    await expect(apiFetch("/auth/login/", { method: "POST" })).rejects.toMatchObject({ status: 401 });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});

describe("apiFetch -- 401 refresh-and-retry flow", () => {
  it("refreshes the token and retries once when a stored refresh token is present", async () => {
    const { apiFetch, setRefreshToken } = await loadApiClient();
    setRefreshToken("stored-refresh-token");

    fetch
      .mockResolvedValueOnce(jsonResponse(401, { detail: "Access token expired" })) // original request
      .mockResolvedValueOnce(jsonResponse(200, { access: "fresh-access-token" })) // refresh call
      .mockResolvedValueOnce(jsonResponse(200, { results: [] })); // retried original request

    const result = await apiFetch("/questions/");

    expect(result).toEqual({ results: [] });
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(fetch.mock.calls[1][0]).toBe(`${API_BASE_URL}/auth/refresh/`);
    // The retry carries the freshly refreshed access token.
    expect(fetch.mock.calls[2][1].headers.Authorization).toBe("Bearer fresh-access-token");
  });

  it("skips the refresh call entirely and rejects with the original 401 when no refresh token is stored", async () => {
    const { apiFetch } = await loadApiClient(); // no setRefreshToken call -> localStorage empty
    fetch.mockResolvedValueOnce(jsonResponse(401, { detail: "Access token expired" }));

    await expect(apiFetch("/questions/")).rejects.toMatchObject({ status: 401 });
    expect(fetch).toHaveBeenCalledTimes(1); // never called /auth/refresh/
  });

  it("clears tokens, fires the unauthorized handler, and rejects with the original 401 when the refresh call itself fails", async () => {
    const { apiFetch, setRefreshToken, setUnauthorizedHandler, getRefreshToken } = await loadApiClient();
    setRefreshToken("stored-refresh-token");
    const onUnauthorized = vi.fn();
    setUnauthorizedHandler(onUnauthorized);

    fetch
      .mockResolvedValueOnce(jsonResponse(401, { detail: "Access token expired" })) // original request
      .mockResolvedValueOnce(jsonResponse(401, { detail: "Refresh token invalid" })); // refresh call fails

    await expect(apiFetch("/questions/")).rejects.toMatchObject({ status: 401 });

    expect(fetch).toHaveBeenCalledTimes(2); // original + failed refresh, no retry
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
    expect(getRefreshToken()).toBeNull();
  });

  it("shares a single in-flight refresh call across concurrent 401s", async () => {
    const { apiFetch, setRefreshToken } = await loadApiClient();
    setRefreshToken("stored-refresh-token");

    fetch
      .mockResolvedValueOnce(jsonResponse(401, {})) // request A, first attempt
      .mockResolvedValueOnce(jsonResponse(401, {})) // request B, first attempt
      .mockResolvedValueOnce(jsonResponse(200, { access: "fresh-access-token" })) // the one shared refresh call
      .mockResolvedValueOnce(jsonResponse(200, { from: "A" })) // request A retried
      .mockResolvedValueOnce(jsonResponse(200, { from: "B" })); // request B retried

    const [resultA, resultB] = await Promise.all([apiFetch("/questions/"), apiFetch("/analytics/dashboard/")]);

    expect(resultA).toEqual({ from: "A" });
    expect(resultB).toEqual({ from: "B" });
    // 2 original + 1 refresh + 2 retries = 5, never 2 refresh calls.
    expect(fetch).toHaveBeenCalledTimes(5);
    const refreshCalls = fetch.mock.calls.filter(([url]) => url === `${API_BASE_URL}/auth/refresh/`);
    expect(refreshCalls).toHaveLength(1);
  });
});

describe("setToken / setRefreshToken / getRefreshToken", () => {
  it("persists and clears the refresh token via localStorage", async () => {
    const { setRefreshToken, getRefreshToken } = await loadApiClient();

    expect(getRefreshToken()).toBeNull();
    setRefreshToken("a-refresh-token");
    expect(getRefreshToken()).toBe("a-refresh-token");
    expect(window.localStorage.getItem("aistp_refresh_token")).toBe("a-refresh-token");

    setRefreshToken(null);
    expect(getRefreshToken()).toBeNull();
    expect(window.localStorage.getItem("aistp_refresh_token")).toBeNull();
  });
});

describe("getErrorMessage", () => {
  it("returns the fallback when the error has no body", async () => {
    const { getErrorMessage } = await loadApiClient();
    expect(getErrorMessage(new Error("network down"), "Something went wrong")).toBe("Something went wrong");
  });

  it("returns the fallback when the body is not an object", async () => {
    const { getErrorMessage } = await loadApiClient();
    const error = { body: "plain text" };
    expect(getErrorMessage(error, "fallback")).toBe("fallback");
  });

  it("returns the fallback when the body is an object with no messages", async () => {
    const { getErrorMessage } = await loadApiClient();
    expect(getErrorMessage({ body: {} }, "fallback")).toBe("fallback");
  });

  it("joins a single {detail} message", async () => {
    const { getErrorMessage } = await loadApiClient();
    const error = { body: { detail: "Not found." } };
    expect(getErrorMessage(error, "fallback")).toBe("Not found.");
  });

  it("flattens multiple field-error arrays into one space-joined string", async () => {
    const { getErrorMessage } = await loadApiClient();
    const error = {
      body: {
        username: ["Already taken."],
        password: ["Too short.", "Must contain a digit."],
      },
    };
    expect(getErrorMessage(error, "fallback")).toBe("Already taken. Too short. Must contain a digit.");
  });
});
