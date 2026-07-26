import { productSchema, productUpdateSchema } from "@/lib/validation/product";

const validProduct = {
  name: "Charizard",
  slug: "charizard",
  price: 100,
  stock_quantity: 5,
  is_active: true,
  is_featured: false,
  is_new: true,
};

describe("productSchema display_order", () => {
  it("defaults to 0 when omitted", () => {
    const result = productSchema.parse(validProduct);
    expect(result.display_order).toBe(0);
  });

  it("accepts a positive integer", () => {
    const result = productSchema.parse({ ...validProduct, display_order: 5 });
    expect(result.display_order).toBe(5);
  });

  it("rejects a negative value", () => {
    const result = productSchema.safeParse({ ...validProduct, display_order: -1 });
    expect(result.success).toBe(false);
  });

  it("rejects a non-integer value", () => {
    const result = productSchema.safeParse({ ...validProduct, display_order: 1.5 });
    expect(result.success).toBe(false);
  });

  it("productUpdateSchema accepts a partial patch with only display_order", () => {
    const result = productUpdateSchema.safeParse({ display_order: 3 });
    expect(result.success).toBe(true);
  });
});
