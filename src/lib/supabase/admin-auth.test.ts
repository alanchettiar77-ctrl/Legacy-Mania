/**
 * @jest-environment node
 */

const mockGetUser = jest.fn();
jest.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: mockGetUser } }),
}));

const originalFetch = global.fetch;

import { requireAdmin } from "@/lib/supabase/admin-auth";

describe("requireAdmin", () => {
  afterEach(() => {
    jest.clearAllMocks();
    global.fetch = originalFetch;
  });

  it("returns ok:false with a 401 response when there is no session user", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const result = await requireAdmin();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(401);
    }
  });

  it("returns ok:false with a 403 response when the user is not an admin", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ role: "customer" }],
    }) as unknown as typeof fetch;

    const result = await requireAdmin();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(403);
    }
  });

  it("returns ok:true with the userId when the user is an admin", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "admin-1" } } });
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ role: "admin" }],
    }) as unknown as typeof fetch;

    const result = await requireAdmin();

    expect(result).toEqual({ ok: true, userId: "admin-1" });
  });

  it("returns ok:false with a 403 response when fetch throws a network error", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    global.fetch = jest.fn().mockRejectedValue(new Error("Network error")) as unknown as typeof fetch;

    const result = await requireAdmin();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(403);
    }
  });

  it("returns ok:false with a 403 response when fetch resolves with ok:false", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
    }) as unknown as typeof fetch;

    const result = await requireAdmin();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(403);
    }
  });

  it("returns ok:false with a 403 response when json parsing throws", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => {
        throw new Error("Invalid JSON");
      },
    }) as unknown as typeof fetch;

    const result = await requireAdmin();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(403);
    }
  });

  it("encodes userId in the query string", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user@domain.com" } } });
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => [],
    });
    global.fetch = mockFetch as unknown as typeof fetch;

    await requireAdmin();

    const fetchCall = mockFetch.mock.calls[0][0];
    expect(fetchCall).toContain(`id=eq.${encodeURIComponent("user@domain.com")}`);
  });
});
