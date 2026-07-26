const mockInsertProduct = jest.fn();
const mockUpdateProduct = jest.fn();
const mockGetMaxDisplayOrder = jest.fn();
const mockFindDisplayOrderConflict = jest.fn();
const mockReorderProducts = jest.fn();
jest.mock("@/lib/repositories/product-repository", () => ({
  insertProduct: (...args: unknown[]) => mockInsertProduct(...args),
  updateProduct: (...args: unknown[]) => mockUpdateProduct(...args),
  getMaxDisplayOrder: (...args: unknown[]) => mockGetMaxDisplayOrder(...args),
  findDisplayOrderConflict: (...args: unknown[]) => mockFindDisplayOrderConflict(...args),
  reorderProducts: (...args: unknown[]) => mockReorderProducts(...args),
}));

import { createProduct, editProduct, setProductActive, suggestDisplayOrder, applyProductSort } from "./product-service";

afterEach(() => jest.clearAllMocks());

const payload = {
  name: "Charizard",
  slug: "charizard",
  description: null,
  price: 100,
  compare_price: null,
  images: [],
  tags: [],
  category_id: null,
  display_order: 1,
  series: null,
  saga: null,
  collection: null,
  stock_quantity: 5,
  sku: null,
  is_active: true,
  is_featured: false,
  is_new: true,
  meta_title: null,
  meta_description: null,
};

it("createProduct delegates to insertProduct", async () => {
  mockInsertProduct.mockResolvedValue({ id: "p1" });
  const result = await createProduct(payload);
  expect(mockInsertProduct).toHaveBeenCalledWith(payload);
  expect(result).toEqual({ id: "p1" });
});

it("editProduct delegates to updateProduct with a partial payload", async () => {
  await editProduct("p1", { price: 150 });
  expect(mockUpdateProduct).toHaveBeenCalledWith("p1", { price: 150 });
});

it("setProductActive updates only is_active", async () => {
  await setProductActive("p1", false);
  expect(mockUpdateProduct).toHaveBeenCalledWith("p1", { is_active: false });
});

describe("createProduct display_order handling", () => {
  it("returns no warning when the display_order is free in the category", async () => {
    mockFindDisplayOrderConflict.mockResolvedValue(false);
    mockInsertProduct.mockResolvedValue({ id: "p1" });

    const result = await createProduct({ ...payload, category_id: "cat-1", display_order: 1 });

    expect(mockFindDisplayOrderConflict).toHaveBeenCalledWith("cat-1", 1, undefined);
    expect(result).toEqual({ id: "p1" });
  });

  it("returns a warning when the display_order conflicts within the category", async () => {
    mockFindDisplayOrderConflict.mockResolvedValue(true);
    mockInsertProduct.mockResolvedValue({ id: "p1" });

    const result = await createProduct({ ...payload, category_id: "cat-1", display_order: 1 });

    expect(result.warning).toMatch(/already used/i);
  });
});

describe("editProduct display_order handling", () => {
  it("checks for conflicts excluding the product's own id when display_order is in the patch", async () => {
    mockFindDisplayOrderConflict.mockResolvedValue(false);

    await editProduct("p1", { display_order: 2, category_id: "cat-1" });

    expect(mockFindDisplayOrderConflict).toHaveBeenCalledWith("cat-1", 2, "p1");
  });

  it("skips the conflict check when display_order isn't in the patch", async () => {
    await editProduct("p1", { price: 150 });

    expect(mockFindDisplayOrderConflict).not.toHaveBeenCalled();
  });
});

describe("suggestDisplayOrder", () => {
  it("returns max + 1 for the category", async () => {
    mockGetMaxDisplayOrder.mockResolvedValue(5);

    const result = await suggestDisplayOrder("cat-1");

    expect(result).toBe(6);
    expect(mockGetMaxDisplayOrder).toHaveBeenCalledWith("cat-1");
  });
});

describe("applyProductSort", () => {
  function makeQuery() {
    const calls: Array<[string, unknown]> = [];
    const query = {
      order: (col: string, opts: unknown) => {
        calls.push([col, opts]);
        return query;
      },
      eq: () => query,
      _calls: calls,
    };
    return query;
  }

  it("defaults to display_order asc, created_at asc when sort is null", () => {
    const query = makeQuery();
    applyProductSort(query, null);
    expect(query._calls).toEqual([
      ["display_order", { ascending: true }],
      ["created_at", { ascending: true }],
    ]);
  });

  it("defaults to display_order asc, created_at asc for an unrecognized sort value", () => {
    const query = makeQuery();
    applyProductSort(query, "not-a-real-sort");
    expect(query._calls).toEqual([
      ["display_order", { ascending: true }],
      ["created_at", { ascending: true }],
    ]);
  });

  it("sorts newest first for 'newest'", () => {
    const query = makeQuery();
    applyProductSort(query, "newest");
    expect(query._calls).toEqual([["created_at", { ascending: false }]]);
  });

  it("sorts oldest first for 'oldest'", () => {
    const query = makeQuery();
    applyProductSort(query, "oldest");
    expect(query._calls).toEqual([["created_at", { ascending: true }]]);
  });

  it("sorts price ascending for 'price_asc'", () => {
    const query = makeQuery();
    applyProductSort(query, "price_asc");
    expect(query._calls).toEqual([["price", { ascending: true }]]);
  });

  it("sorts price descending for 'price_desc'", () => {
    const query = makeQuery();
    applyProductSort(query, "price_desc");
    expect(query._calls).toEqual([["price", { ascending: false }]]);
  });

  it("sorts name ascending for 'name_asc'", () => {
    const query = makeQuery();
    applyProductSort(query, "name_asc");
    expect(query._calls).toEqual([["name", { ascending: true }]]);
  });

  it("sorts name descending for 'name_desc'", () => {
    const query = makeQuery();
    applyProductSort(query, "name_desc");
    expect(query._calls).toEqual([["name", { ascending: false }]]);
  });

  it("sorts featured first, then display_order for 'featured'", () => {
    const query = makeQuery();
    applyProductSort(query, "featured");
    expect(query._calls).toEqual([
      ["is_featured", { ascending: false }],
      ["display_order", { ascending: true }],
    ]);
  });

  it("explicit 'display_order' behaves the same as the default", () => {
    const query = makeQuery();
    applyProductSort(query, "display_order");
    expect(query._calls).toEqual([
      ["display_order", { ascending: true }],
      ["created_at", { ascending: true }],
    ]);
  });
});
