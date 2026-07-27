/**
 * @jest-environment node
 */
const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

beforeEach(() => {
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
});
afterEach(() => jest.clearAllMocks());

import {
  listActiveCategories,
  listAllCategories,
  getCategoryById,
  getCategoryBySlug,
  softDeleteCategory,
} from "./category-repository";

describe("listActiveCategories", () => {
  it("filters out soft-deleted rows via deleted_at=is.null", async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => [] });
    await listActiveCategories();
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("deleted_at=is.null");
  });
});

describe("listAllCategories", () => {
  it("filters out soft-deleted rows via deleted_at=is.null", async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => [] });
    await listAllCategories();
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("deleted_at=is.null");
  });
});

describe("getCategoryById", () => {
  it("returns the row when found", async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => [{ id: "a", name: "A" }] });
    await expect(getCategoryById("a")).resolves.toEqual({ id: "a", name: "A" });
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("id=eq.a");
    expect(url).toContain("deleted_at=is.null");
  });

  it("returns null when not found", async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => [] });
    await expect(getCategoryById("missing")).resolves.toBeNull();
  });
});

describe("getCategoryBySlug", () => {
  it("returns the row when found", async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => [{ id: "a", slug: "pokemon" }] });
    await expect(getCategoryBySlug("pokemon")).resolves.toEqual({ id: "a", slug: "pokemon" });
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("slug=eq.pokemon");
  });

  it("returns null when not found", async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => [] });
    await expect(getCategoryBySlug("missing")).resolves.toBeNull();
  });
});

describe("softDeleteCategory", () => {
  it("PATCHes deleted_at to a timestamp", async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => [{}] });
    await softDeleteCategory("a");
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toContain("id=eq.a");
    expect(init.method).toBe("PATCH");
    const body = JSON.parse(init.body as string);
    expect(body.deleted_at).toBeDefined();
    expect(new Date(body.deleted_at).toString()).not.toBe("Invalid Date");
  });

  it("throws if the PATCH fails", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500 });
    await expect(softDeleteCategory("a")).rejects.toThrow();
  });
});
