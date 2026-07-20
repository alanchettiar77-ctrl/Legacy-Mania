const mockGetRecentAttempts = jest.fn();
const mockRecordLoginAttempt = jest.fn();
jest.mock("@/lib/repositories/login-attempt-repository", () => ({
  getRecentAttempts: (...args: unknown[]) => mockGetRecentAttempts(...args),
  recordLoginAttempt: (...args: unknown[]) => mockRecordLoginAttempt(...args),
}));

import { isLocked, getProgressiveDelayMs, recordAttemptResult } from "./login-throttle-service";

afterEach(() => jest.clearAllMocks());

describe("isLocked", () => {
  it("false when fewer than 5 attempts exist", async () => {
    mockGetRecentAttempts.mockResolvedValue([
      { succeeded: false, created_at: new Date().toISOString() },
    ]);
    expect(await isLocked("a@b.com")).toBe(false);
  });

  it("false when the last 5 include a success", async () => {
    const now = Date.now();
    mockGetRecentAttempts.mockResolvedValue([
      { succeeded: true, created_at: new Date(now).toISOString() },
      { succeeded: false, created_at: new Date(now - 1000).toISOString() },
      { succeeded: false, created_at: new Date(now - 2000).toISOString() },
      { succeeded: false, created_at: new Date(now - 3000).toISOString() },
      { succeeded: false, created_at: new Date(now - 4000).toISOString() },
    ]);
    expect(await isLocked("a@b.com")).toBe(false);
  });

  it("true when the last 5 are all failures within the last 15 minutes", async () => {
    const now = Date.now();
    mockGetRecentAttempts.mockResolvedValue(
      Array.from({ length: 5 }, (_, i) => ({
        succeeded: false,
        created_at: new Date(now - i * 1000).toISOString(),
      }))
    );
    expect(await isLocked("a@b.com")).toBe(true);
  });

  it("false when the last 5 are all failures but the most recent is older than 15 minutes", async () => {
    const old = Date.now() - 16 * 60 * 1000;
    mockGetRecentAttempts.mockResolvedValue(
      Array.from({ length: 5 }, (_, i) => ({
        succeeded: false,
        created_at: new Date(old - i * 1000).toISOString(),
      }))
    );
    expect(await isLocked("a@b.com")).toBe(false);
  });
});

describe("getProgressiveDelayMs", () => {
  it("0ms with no prior failures", async () => {
    mockGetRecentAttempts.mockResolvedValue([]);
    expect(await getProgressiveDelayMs("a@b.com")).toBe(0);
  });

  it("scales up with trailing consecutive failures", async () => {
    const now = Date.now();
    mockGetRecentAttempts.mockResolvedValue([
      { succeeded: false, created_at: new Date(now).toISOString() },
      { succeeded: false, created_at: new Date(now - 1000).toISOString() },
    ]);
    expect(await getProgressiveDelayMs("a@b.com")).toBe(700);
  });

  it("stops counting at the most recent success", async () => {
    const now = Date.now();
    mockGetRecentAttempts.mockResolvedValue([
      { succeeded: false, created_at: new Date(now).toISOString() },
      { succeeded: true, created_at: new Date(now - 1000).toISOString() },
      { succeeded: false, created_at: new Date(now - 2000).toISOString() },
    ]);
    expect(await getProgressiveDelayMs("a@b.com")).toBe(300);
  });

  it("caps at the last entry in the delay schedule", async () => {
    const now = Date.now();
    mockGetRecentAttempts.mockResolvedValue(
      Array.from({ length: 5 }, (_, i) => ({
        succeeded: false,
        created_at: new Date(now - i * 1000).toISOString(),
      }))
    );
    expect(await getProgressiveDelayMs("a@b.com")).toBe(3000);
  });
});

describe("recordAttemptResult", () => {
  it("never throws even when the repository write fails", async () => {
    mockRecordLoginAttempt.mockRejectedValue(new Error("db down"));
    await expect(recordAttemptResult("a@b.com", "1.2.3.4", false)).resolves.toBeUndefined();
  });
});
