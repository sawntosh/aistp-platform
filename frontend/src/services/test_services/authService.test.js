import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../apiClient", () => ({
  apiFetch: vi.fn(),
  getRefreshToken: vi.fn(),
  setRefreshToken: vi.fn(),
  setToken: vi.fn(),
}));

import { apiFetch, getRefreshToken, setRefreshToken, setToken } from "../apiClient";
import {
  changePassword,
  checkAvailability,
  confirmPasswordReset,
  fetchCurrentUser,
  login,
  logout,
  refreshSession,
  register,
  requestPasswordReset,
  resendVerification,
  verifyEmail,
} from "../authService";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("register", () => {
  it("POSTs to /auth/register/ with confirm_password in snake_case", async () => {
    apiFetch.mockResolvedValueOnce({ ok: true });

    await register({ username: "ada", email: "ada@gmail.com", password: "Str0ng!Pass", confirmPassword: "Str0ng!Pass" });

    expect(apiFetch).toHaveBeenCalledWith("/auth/register/", {
      method: "POST",
      body: JSON.stringify({
        username: "ada",
        email: "ada@gmail.com",
        password: "Str0ng!Pass",
        confirm_password: "Str0ng!Pass",
      }),
    });
  });
});

describe("checkAvailability", () => {
  it("includes only the params that were provided", async () => {
    apiFetch.mockResolvedValue({});

    await checkAvailability({ username: "ada" });
    expect(apiFetch).toHaveBeenLastCalledWith("/auth/availability/?username=ada");

    await checkAvailability({ email: "ada@gmail.com" });
    expect(apiFetch).toHaveBeenLastCalledWith("/auth/availability/?email=ada%40gmail.com");

    await checkAvailability({ username: "ada", email: "ada@gmail.com" });
    expect(apiFetch).toHaveBeenLastCalledWith("/auth/availability/?username=ada&email=ada%40gmail.com");
  });

  it("builds an empty query when called with no arguments", async () => {
    apiFetch.mockResolvedValueOnce({});
    await checkAvailability();
    expect(apiFetch).toHaveBeenCalledWith("/auth/availability/?");
  });
});

describe("verifyEmail / resendVerification / password reset", () => {
  it("verifyEmail POSTs email and code", async () => {
    apiFetch.mockResolvedValueOnce({});
    await verifyEmail({ email: "ada@gmail.com", code: "123456" });
    expect(apiFetch).toHaveBeenCalledWith("/auth/verify-email/", {
      method: "POST",
      body: JSON.stringify({ email: "ada@gmail.com", code: "123456" }),
    });
  });

  it("resendVerification POSTs just the email", async () => {
    apiFetch.mockResolvedValueOnce({});
    await resendVerification("ada@gmail.com");
    expect(apiFetch).toHaveBeenCalledWith("/auth/resend-verification/", {
      method: "POST",
      body: JSON.stringify({ email: "ada@gmail.com" }),
    });
  });

  it("requestPasswordReset POSTs just the email", async () => {
    apiFetch.mockResolvedValueOnce({});
    await requestPasswordReset("ada@gmail.com");
    expect(apiFetch).toHaveBeenCalledWith("/auth/password-reset/", {
      method: "POST",
      body: JSON.stringify({ email: "ada@gmail.com" }),
    });
  });

  it("confirmPasswordReset POSTs the code and both passwords in snake_case", async () => {
    apiFetch.mockResolvedValueOnce({});
    await confirmPasswordReset({ email: "ada@gmail.com", code: "654321", password: "New!Pass1", confirmPassword: "New!Pass1" });
    expect(apiFetch).toHaveBeenCalledWith("/auth/password-reset/confirm/", {
      method: "POST",
      body: JSON.stringify({
        email: "ada@gmail.com",
        code: "654321",
        password: "New!Pass1",
        confirm_password: "New!Pass1",
      }),
    });
  });
});

describe("login", () => {
  it("logs in, then stores the access and refresh tokens, and returns the response", async () => {
    const data = { access: "access-tok", refresh: "refresh-tok" };
    apiFetch.mockResolvedValueOnce(data);

    const result = await login({ username: "ada", password: "Str0ng!Pass" });

    expect(apiFetch).toHaveBeenCalledWith("/auth/login/", {
      method: "POST",
      body: JSON.stringify({ username: "ada", password: "Str0ng!Pass" }),
    });
    expect(setToken).toHaveBeenCalledWith("access-tok");
    expect(setRefreshToken).toHaveBeenCalledWith("refresh-tok");
    expect(result).toBe(data);
  });
});

describe("refreshSession", () => {
  it("returns null without calling apiFetch when there is no stored refresh token", async () => {
    getRefreshToken.mockReturnValue(null);

    const result = await refreshSession();

    expect(result).toBeNull();
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("exchanges the stored refresh token for a fresh access token", async () => {
    getRefreshToken.mockReturnValue("stored-refresh-tok");
    apiFetch.mockResolvedValueOnce({ access: "fresh-access-tok" });

    const result = await refreshSession();

    expect(apiFetch).toHaveBeenCalledWith("/auth/refresh/", {
      method: "POST",
      body: JSON.stringify({ refresh: "stored-refresh-tok" }),
    });
    expect(setToken).toHaveBeenCalledWith("fresh-access-tok");
    expect(result).toBe("fresh-access-tok");
  });

  it("clears the refresh token and returns null when the refresh call fails", async () => {
    getRefreshToken.mockReturnValue("stale-refresh-tok");
    apiFetch.mockRejectedValueOnce(new Error("API error: 401"));

    const result = await refreshSession();

    expect(setRefreshToken).toHaveBeenCalledWith(null);
    expect(result).toBeNull();
  });
});

describe("fetchCurrentUser", () => {
  it("GETs /auth/me/", async () => {
    apiFetch.mockResolvedValueOnce({ username: "ada" });
    const result = await fetchCurrentUser();
    expect(apiFetch).toHaveBeenCalledWith("/auth/me/");
    expect(result).toEqual({ username: "ada" });
  });
});

describe("logout", () => {
  it("clears both the in-memory access token and the stored refresh token", () => {
    logout();
    expect(setToken).toHaveBeenCalledWith(null);
    expect(setRefreshToken).toHaveBeenCalledWith(null);
  });
});

describe("changePassword", () => {
  it("POSTs all three fields in snake_case", async () => {
    apiFetch.mockResolvedValueOnce({});
    await changePassword({ oldPassword: "Old!Pass1", newPassword: "New!Pass1", confirmNewPassword: "New!Pass1" });
    expect(apiFetch).toHaveBeenCalledWith("/auth/change-password/", {
      method: "POST",
      body: JSON.stringify({
        old_password: "Old!Pass1",
        new_password: "New!Pass1",
        confirm_new_password: "New!Pass1",
      }),
    });
  });
});
