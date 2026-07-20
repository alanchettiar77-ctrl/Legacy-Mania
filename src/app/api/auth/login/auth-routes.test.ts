/**
 * @jest-environment node
 *
 * Covers POST /api/auth/login and POST /api/auth/register.
 */
const mockSignIn = jest.fn();
const mockSignUp = jest.fn();
const mockResetPasswordForEmail = jest.fn();
jest.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      signInWithPassword: (...args: unknown[]) => mockSignIn(...args),
      signUp: (...args: unknown[]) => mockSignUp(...args),
      resetPasswordForEmail: (...args: unknown[]) => mockResetPasswordForEmail(...args),
    },
  }),
}));

const mockCheckRateLimit = jest.fn();
jest.mock("@/lib/rate-limit", () => ({
  checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args),
  rateLimitResponse: jest.requireActual("@/lib/rate-limit").rateLimitResponse,
}));

const mockIsLocked = jest.fn();
const mockGetProgressiveDelayMs = jest.fn();
const mockRecordAttemptResult = jest.fn();
jest.mock("@/lib/services/login-throttle-service", () => ({
  isLocked: (...args: unknown[]) => mockIsLocked(...args),
  getProgressiveDelayMs: (...args: unknown[]) => mockGetProgressiveDelayMs(...args),
  recordAttemptResult: (...args: unknown[]) => mockRecordAttemptResult(...args),
}));

jest.mock("@/lib/services/audit-service", () => ({ recordAuditLog: jest.fn() }));
// eslint-disable-next-line @typescript-eslint/no-require-imports
const audit = jest.requireMock("@/lib/services/audit-service");

import { NextRequest } from "next/server";
import { POST as login } from "@/app/api/auth/login/route";
import { POST as register } from "@/app/api/auth/register/route";

function req(path: string, body: unknown) {
  return new NextRequest(`http://localhost/api/auth/${path}`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  mockCheckRateLimit.mockReturnValue({ allowed: true, remaining: 9, resetAt: Date.now() + 60_000 });
  mockIsLocked.mockResolvedValue(false);
  mockGetProgressiveDelayMs.mockResolvedValue(0);
});
afterEach(() => jest.clearAllMocks());

describe("POST /api/auth/login", () => {
  it("429 when rate limited, before any auth attempt", async () => {
    mockCheckRateLimit.mockReturnValue({ allowed: false, remaining: 0, resetAt: Date.now() + 5_000 });
    const response = await login(req("login", { email: "a@b.com", password: "secret1" }));
    expect(response.status).toBe(429);
    expect(mockSignIn).not.toHaveBeenCalled();
  });

  it("400 generic error on invalid input + validation audit, no field leak", async () => {
    const response = await login(req("login", { email: "not-an-email", password: "secret1" }));
    const body = await response.json();
    expect(response.status).toBe(400);
    expect(body).toEqual({ error: "Invalid input" });
    expect(mockSignIn).not.toHaveBeenCalled();
    expect(audit.recordAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "auth.validation_failed" })
    );
  });

  it("401 generic error on bad credentials (no enumeration) + failure audit", async () => {
    mockSignIn.mockResolvedValue({ error: { message: "Invalid login credentials" } });
    const response = await login(req("login", { email: "a@b.com", password: "wrongpass" }));
    const body = await response.json();
    expect(response.status).toBe(401);
    expect(body).toEqual({ error: "Invalid email or password" });
    expect(audit.recordAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "auth.login_failed" })
    );
  });

  it("200 with normalized email on success", async () => {
    mockSignIn.mockResolvedValue({ error: null });
    const response = await login(req("login", { email: "  A@B.com ", password: "secret1" }));
    expect(response.status).toBe(200);
    expect(mockSignIn).toHaveBeenCalledWith({ email: "a@b.com", password: "secret1" });
  });

  it("400 on non-JSON body", async () => {
    const bad = new NextRequest("http://localhost/api/auth/login", { method: "POST", body: "not json" });
    expect((await login(bad)).status).toBe(400);
  });

  it("401 generic error when the account is locked, without calling signInWithPassword", async () => {
    mockIsLocked.mockResolvedValue(true);
    const response = await login(req("login", { email: "a@b.com", password: "whatever1" }));
    const body = await response.json();
    expect(response.status).toBe(401);
    expect(body).toEqual({ error: "Invalid email or password" });
    expect(mockSignIn).not.toHaveBeenCalled();
    expect(mockRecordAttemptResult).toHaveBeenCalledWith("a@b.com", expect.any(String), false);
  });

  it("does not resend the lockout email on repeated blocked attempts while already locked", async () => {
    mockIsLocked.mockResolvedValue(true);
    await login(req("login", { email: "a@b.com", password: "whatever1" }));
    expect(mockResetPasswordForEmail).not.toHaveBeenCalled();
  });

  it("sends a reset-link email exactly once when a failed attempt newly triggers lockout", async () => {
    mockIsLocked.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    mockSignIn.mockResolvedValue({ error: { message: "Invalid login credentials" } });
    await login(req("login", { email: "a@b.com", password: "wrongpass" }));
    expect(mockResetPasswordForEmail).toHaveBeenCalledTimes(1);
    expect(mockResetPasswordForEmail).toHaveBeenCalledWith("a@b.com");
  });

  it("does not send a lockout email on an ordinary (non-locking) failed attempt", async () => {
    mockIsLocked.mockResolvedValue(false);
    mockSignIn.mockResolvedValue({ error: { message: "Invalid login credentials" } });
    await login(req("login", { email: "a@b.com", password: "wrongpass" }));
    expect(mockResetPasswordForEmail).not.toHaveBeenCalled();
  });

  it("records a successful attempt on successful login", async () => {
    mockSignIn.mockResolvedValue({ error: null });
    await login(req("login", { email: "a@b.com", password: "secret1" }));
    expect(mockRecordAttemptResult).toHaveBeenCalledWith("a@b.com", expect.any(String), true);
  });
});

describe("POST /api/auth/register", () => {
  const valid = { fullName: "Arjun", email: "a@b.com", phone: "9876543210", password: "longenough" };

  it("400 generic on invalid input; supabase never called", async () => {
    const response = await register(req("register", { ...valid, password: "short" }));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid input" });
    expect(mockSignUp).not.toHaveBeenCalled();
  });

  it("sanitizes the name before it reaches auth metadata", async () => {
    mockSignUp.mockResolvedValue({ error: null });
    await register(req("register", { ...valid, fullName: "<script>x</script>Arjun" }));
    expect(mockSignUp).toHaveBeenCalledWith(
      expect.objectContaining({
        options: { data: { full_name: "xArjun", phone: "9876543210" } },
      })
    );
  });

  it("400 generic on supabase error (no email-exists leak) + failure audit", async () => {
    mockSignUp.mockResolvedValue({ error: { message: "User already registered" } });
    const response = await register(req("register", valid));
    const body = await response.json();
    expect(response.status).toBe(400);
    expect(body.error).not.toMatch(/registered|exists/i);
    expect(audit.recordAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "auth.register_failed" })
    );
  });

  it("200 on success", async () => {
    mockSignUp.mockResolvedValue({ error: null });
    expect((await register(req("register", valid))).status).toBe(200);
  });
});
