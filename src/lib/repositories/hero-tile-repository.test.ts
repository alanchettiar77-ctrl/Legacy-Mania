/**
 * @jest-environment node
 */
const originalFetchHeroTile = global.fetch;

beforeEach(() => {
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key";
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
  global.fetch = jest.fn();
});

afterEach(() => {
  global.fetch = originalFetchHeroTile;
  jest.resetModules();
});

describe("hero-tile-repository", () => {
  it("listHeroTiles requests non-deleted rows ordered by display_order", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => [{ id: "t1" }] });
    const { listHeroTiles } = await import("@/lib/repositories/hero-tile-repository");

    const rows = await listHeroTiles();

    expect(rows).toEqual([{ id: "t1" }]);
    const [url] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toContain("deleted_at=is.null");
    expect(url).toContain("order=display_order.asc");
  });

  it("listActiveHeroTiles filters by is_active and deleted_at", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => [] });
    const { listActiveHeroTiles } = await import("@/lib/repositories/hero-tile-repository");

    await listActiveHeroTiles();

    const [url] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toContain("is_active=eq.true");
    expect(url).toContain("deleted_at=is.null");
  });

  it("insertHeroTile POSTs to the hero_tiles table and returns the created row", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => [{ id: "t1", label: "Pikachu" }],
    });
    const { insertHeroTile } = await import("@/lib/repositories/hero-tile-repository");

    const row = await insertHeroTile({ label: "Pikachu" });

    expect(row).toEqual({ id: "t1", label: "Pikachu" });
    const [url, opts] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toBe("https://test.supabase.co/rest/v1/hero_tiles");
    expect(opts.method).toBe("POST");
  });

  it("softDeleteHeroTile PATCHes deleted_at and updated_by", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => [{ id: "t1" }] });
    const { softDeleteHeroTile } = await import("@/lib/repositories/hero-tile-repository");

    const result = await softDeleteHeroTile("t1", "admin-1");

    expect(result).toBe(true);
    const [, opts] = (global.fetch as jest.Mock).mock.calls[0];
    const body = JSON.parse(opts.body);
    expect(body.deleted_at).toBeDefined();
    expect(body.updated_by).toBe("admin-1");
  });

  it("reorderHeroTiles PATCHes each id with its new display_order", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => [{}] });
    const { reorderHeroTiles } = await import("@/lib/repositories/hero-tile-repository");

    await reorderHeroTiles(["t2", "t1"], "admin-1");

    expect(global.fetch).toHaveBeenCalledTimes(2);
    const firstBody = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    const secondBody = JSON.parse((global.fetch as jest.Mock).mock.calls[1][1].body);
    expect(firstBody.display_order).toBe(0);
    expect(secondBody.display_order).toBe(1);
  });

  it("getMaxDisplayOrder returns -1 when the table is empty", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => [] });
    const { getMaxDisplayOrder } = await import("@/lib/repositories/hero-tile-repository");

    expect(await getMaxDisplayOrder()).toBe(-1);
  });
});
