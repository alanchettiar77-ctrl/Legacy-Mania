/**
 * @jest-environment node
 */
export {};

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

  it("getProduct returns the row's category_id", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => [{ category_id: "cat-real" }],
    });
    const { getProduct } = await import("@/lib/repositories/product-repository");

    const result = await getProduct("p1");

    expect(result).toEqual({ category_id: "cat-real" });
    const [url] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toContain("id=eq.p1");
    expect(url).toContain("select=category_id");
  });

  it("getProduct returns null when the response is not ok", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: false, json: async () => [] });
    const { getProduct } = await import("@/lib/repositories/product-repository");

    const result = await getProduct("missing");

    expect(result).toBeNull();
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

describe("countProductsByCategory", () => {
  it("requests a count-only response and returns the total", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      headers: { get: (name: string) => (name.toLowerCase() === "content-range" ? "0-0/7" : null) },
      json: async () => [],
    });
    const { countProductsByCategory } = await import("@/lib/repositories/product-repository");

    await expect(countProductsByCategory("cat-1")).resolves.toBe(7);
    const url = (global.fetch as jest.Mock).mock.calls[0][0] as string;
    expect(url).toContain("category_id=eq.cat-1");
  });

  it("returns 0 when the category has no products", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      headers: { get: () => "0-(-1)/0" },
      json: async () => [],
    });
    const { countProductsByCategory } = await import("@/lib/repositories/product-repository");

    await expect(countProductsByCategory("cat-empty")).resolves.toBe(0);
  });
});

describe("reassignProductsCategory", () => {
  it("PATCHes every product in fromCategoryId to toCategoryId", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => [{ id: "p1" }, { id: "p2" }],
    });
    const { reassignProductsCategory } = await import("@/lib/repositories/product-repository");

    await expect(reassignProductsCategory("cat-old", "cat-new")).resolves.toBe(2);
    const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toContain("category_id=eq.cat-old");
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body as string)).toEqual({ category_id: "cat-new" });
  });

  it("throws if the PATCH fails", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: false, status: 500 });
    const { reassignProductsCategory } = await import("@/lib/repositories/product-repository");

    await expect(reassignProductsCategory("cat-old", "cat-new")).rejects.toThrow();
  });
});
