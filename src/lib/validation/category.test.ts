import {
  categorySchema,
  categoryUpdateSchema,
  categoryDeleteSchema,
  categoryReassignProductsSchema,
} from "./category";

describe("categorySchema", () => {
  it("accepts a valid category", () => {
    const result = categorySchema.safeParse({
      name: "T-Shirts",
      slug: "t-shirts",
      description: null,
      parent_id: null,
      display_order: 0,
      is_active: true,
    });
    expect(result.success).toBe(true);
  });

  it("accepts optional SEO fields", () => {
    const result = categorySchema.safeParse({
      name: "Kanto",
      slug: "kanto",
      meta_title: "Kanto Cards — Legacy Mania",
      meta_description: "Shop Kanto region Pokémon cards.",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a slug with uppercase or spaces", () => {
    expect(categorySchema.safeParse({ name: "Kanto", slug: "Kanto Region" }).success).toBe(false);
  });

  it("rejects a slug with leading/trailing hyphens", () => {
    expect(categorySchema.safeParse({ name: "Kanto", slug: "-kanto-" }).success).toBe(false);
  });

  it("accepts a valid hyphenated slug", () => {
    expect(categorySchema.safeParse({ name: "Dragon Ball Z", slug: "dragon-ball-z" }).success).toBe(true);
  });
});

describe("categoryUpdateSchema", () => {
  it("accepts a partial update", () => {
    expect(categoryUpdateSchema.safeParse({ is_active: false }).success).toBe(true);
  });
});

describe("categoryDeleteSchema", () => {
  it("accepts no options", () => {
    expect(categoryDeleteSchema.safeParse({}).success).toBe(true);
  });

  it("accepts reassignment targets", () => {
    const result = categoryDeleteSchema.safeParse({
      reassignChildrenTo: "11111111-1111-1111-1111-111111111111",
      reassignProductsTo: "22222222-2222-2222-2222-222222222222",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a non-uuid reassignment target", () => {
    expect(categoryDeleteSchema.safeParse({ reassignProductsTo: "not-a-uuid" }).success).toBe(false);
  });
});

describe("categoryReassignProductsSchema", () => {
  it("requires toCategoryId", () => {
    expect(categoryReassignProductsSchema.safeParse({}).success).toBe(false);
  });

  it("accepts a valid toCategoryId", () => {
    const result = categoryReassignProductsSchema.safeParse({
      toCategoryId: "11111111-1111-1111-1111-111111111111",
    });
    expect(result.success).toBe(true);
  });
});
