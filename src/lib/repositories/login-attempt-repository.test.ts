const originalFetch = global.fetch;

import { recordLoginAttempt, getRecentAttempts } from "./login-attempt-repository";

describe("recordLoginAttempt", () => {
  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it("POSTs to the login_attempts REST endpoint with the given fields", async () => {
    const mockFetch = jest.fn().mockResolvedValue({ ok: true });
    global.fetch = mockFetch as unknown as typeof fetch;

    await recordLoginAttempt({ identifier: "a@b.com", ip: "1.2.3.4", succeeded: false });

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/rest/v1/login_attempts"),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ identifier: "a@b.com", ip: "1.2.3.4", succeeded: false }),
      })
    );
  });

  it("throws when the insert fails, so the caller can decide how to handle it", async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 500 }) as unknown as typeof fetch;
    await expect(
      recordLoginAttempt({ identifier: "a@b.com", ip: "1.2.3.4", succeeded: false })
    ).rejects.toThrow();
  });
});

describe("getRecentAttempts", () => {
  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it("GETs the last N attempts for an identifier, ordered newest first", async () => {
    const rows = [
      { succeeded: false, created_at: "2026-07-21T10:05:00Z" },
      { succeeded: false, created_at: "2026-07-21T10:04:00Z" },
    ];
    const mockFetch = jest.fn().mockResolvedValue({ ok: true, json: async () => rows });
    global.fetch = mockFetch as unknown as typeof fetch;

    const result = await getRecentAttempts("a@b.com", 5);

    expect(result).toEqual(rows);
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("identifier=eq.a%40b.com");
    expect(url).toContain("order=created_at.desc");
    expect(url).toContain("limit=5");
  });

  it("returns an empty array when the request fails", async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false }) as unknown as typeof fetch;
    expect(await getRecentAttempts("a@b.com", 5)).toEqual([]);
  });
});
