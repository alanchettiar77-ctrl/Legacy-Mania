/**
 * @jest-environment node
 */
const originalFetch = global.fetch;

beforeEach(() => {
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key";
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
  global.fetch = jest.fn();
});

afterEach(() => {
  global.fetch = originalFetch;
  jest.resetModules();
});

describe("banner-repository", () => {
  it("listBanners requests non-deleted rows ordered by display_order", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => [{ id: "b1" }],
    });
    const { listBanners } = await import("@/lib/repositories/banner-repository");

    const rows = await listBanners();

    expect(rows).toEqual([{ id: "b1" }]);
    const [url] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toContain("deleted_at=is.null");
    expect(url).toContain("order=display_order.asc");
  });

  it("listActiveBanners filters by is_active, schedule window, and deleted_at", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => [] });
    const { listActiveBanners } = await import("@/lib/repositories/banner-repository");

    await listActiveBanners("2026-07-23T00:00:00Z");

    const [url] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toContain("is_active=eq.true");
    expect(url).toContain("deleted_at=is.null");
  });

  it("insertBanner POSTs to the banners table and returns the created row", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => [{ id: "b1", title: "Sale" }],
    });
    const { insertBanner } = await import("@/lib/repositories/banner-repository");

    const row = await insertBanner({ title: "Sale" });

    expect(row).toEqual({ id: "b1", title: "Sale" });
    const [url, options] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toContain("/rest/v1/banners");
    expect(options.method).toBe("POST");
  });

  it("reorderBanners PATCHes each id with its new display_order", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => [{}] });
    const { reorderBanners } = await import("@/lib/repositories/banner-repository");

    await reorderBanners(["b1", "b2"], "admin-1");

    expect(global.fetch).toHaveBeenCalledTimes(2);
    const secondCallBody = JSON.parse((global.fetch as jest.Mock).mock.calls[1][1].body);
    expect(secondCallBody).toEqual({ display_order: 1, updated_by: "admin-1" });
  });

  it("throws when the PostgREST response is not ok", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 500 });
    const { listBanners } = await import("@/lib/repositories/banner-repository");

    await expect(listBanners()).rejects.toThrow("Failed to list banners: 500");
  });
});
