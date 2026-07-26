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

describe("product-repository display_order helpers", () => {
  it("getMaxDisplayOrder returns 0 when the category has no products", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => [] });
    const { getMaxDisplayOrder } = await import("@/lib/repositories/product-repository");

    const result = await getMaxDisplayOrder("cat-1");

    expect(result).toBe(0);
    const [url] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toContain("category_id=eq.cat-1");
    expect(url).toContain("order=display_order.desc");
  });

  it("getMaxDisplayOrder returns the highest existing value", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => [{ display_order: 7 }],
    });
    const { getMaxDisplayOrder } = await import("@/lib/repositories/product-repository");

    const result = await getMaxDisplayOrder("cat-1");

    expect(result).toBe(7);
  });

  it("getMaxDisplayOrder filters on category_id=is.null when category is null", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => [] });
    const { getMaxDisplayOrder } = await import("@/lib/repositories/product-repository");

    await getMaxDisplayOrder(null);

    const [url] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toContain("category_id=is.null");
  });

  it("findDisplayOrderConflict returns true when another product shares the order in-category", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => [{ id: "other-product" }],
    });
    const { findDisplayOrderConflict } = await import("@/lib/repositories/product-repository");

    const result = await findDisplayOrderConflict("cat-1", 3);

    expect(result).toBe(true);
    const [url] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toContain("category_id=eq.cat-1");
    expect(url).toContain("display_order=eq.3");
  });

  it("findDisplayOrderConflict excludes the product being edited", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => [] });
    const { findDisplayOrderConflict } = await import("@/lib/repositories/product-repository");

    await findDisplayOrderConflict("cat-1", 3, "self-id");

    const [url] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toContain("id=neq.self-id");
  });

  it("findDisplayOrderConflict returns false when nothing else shares the order", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => [] });
    const { findDisplayOrderConflict } = await import("@/lib/repositories/product-repository");

    const result = await findDisplayOrderConflict("cat-1", 3);

    expect(result).toBe(false);
  });

  it("reorderProducts PATCHes each id with its new display_order", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => [{}] });
    const { reorderProducts } = await import("@/lib/repositories/product-repository");

    await reorderProducts(["p1", "p2"]);

    expect(global.fetch).toHaveBeenCalledTimes(2);
    const secondCallBody = JSON.parse((global.fetch as jest.Mock).mock.calls[1][1].body);
    expect(secondCallBody).toEqual({ display_order: 1 });
  });
});
