/**
 * @jest-environment node
 */
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

describe("checkRateLimit", () => {
  it("allows requests up to the limit within the window", () => {
    const key = `test-allow-${Date.now()}`;
    expect(checkRateLimit(key, 3, 60_000).allowed).toBe(true);
    expect(checkRateLimit(key, 3, 60_000).allowed).toBe(true);
    expect(checkRateLimit(key, 3, 60_000).allowed).toBe(true);
  });

  it("blocks the request after the limit is reached within the same window", () => {
    const key = `test-block-${Date.now()}`;
    checkRateLimit(key, 2, 60_000);
    checkRateLimit(key, 2, 60_000);
    const third = checkRateLimit(key, 2, 60_000);
    expect(third.allowed).toBe(false);
    expect(third.remaining).toBe(0);
  });

  it("decrements remaining on each allowed call", () => {
    const key = `test-remaining-${Date.now()}`;
    expect(checkRateLimit(key, 3, 60_000).remaining).toBe(2);
    expect(checkRateLimit(key, 3, 60_000).remaining).toBe(1);
    expect(checkRateLimit(key, 3, 60_000).remaining).toBe(0);
  });

  it("resets the count once the window has fully elapsed", async () => {
    const key = `test-reset-${Date.now()}`;
    checkRateLimit(key, 1, 50);
    expect(checkRateLimit(key, 1, 50).allowed).toBe(false);
    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(checkRateLimit(key, 1, 50).allowed).toBe(true);
  });

  it("tracks separate keys independently", () => {
    const keyA = `test-a-${Date.now()}`;
    const keyB = `test-b-${Date.now()}`;
    checkRateLimit(keyA, 1, 60_000);
    expect(checkRateLimit(keyA, 1, 60_000).allowed).toBe(false);
    expect(checkRateLimit(keyB, 1, 60_000).allowed).toBe(true);
  });
});

describe("rateLimitResponse", () => {
  it("returns a 429 response with a Retry-After header", async () => {
    const resetAt = Date.now() + 5000;
    const response = rateLimitResponse(resetAt);
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBeDefined();
    const body = await response.json();
    expect(body.error).toBe("Too many requests");
  });
});
