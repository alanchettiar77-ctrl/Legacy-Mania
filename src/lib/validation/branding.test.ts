/**
 * @jest-environment node
 */
import {
  brandingUpdateSchema,
  categoryBrandingSchema,
  categoryOrderSchema,
} from "@/lib/validation/branding";

describe("brandingUpdateSchema", () => {
  it("accepts relative, http(s), and empty (clear) urls", () => {
    expect(brandingUpdateSchema.safeParse({ logo_url: "/logo.png" }).success).toBe(true);
    expect(brandingUpdateSchema.safeParse({ favicon_url: "https://x.com/f.ico" }).success).toBe(true);
    expect(brandingUpdateSchema.safeParse({ logo_url: "" }).success).toBe(true);
  });

  it("rejects javascript: urls, unknown-shape values, empty patch", () => {
    expect(brandingUpdateSchema.safeParse({ logo_url: "javascript:alert(1)" }).success).toBe(false);
    expect(brandingUpdateSchema.safeParse({ logo_hidden: "yes" }).success).toBe(false);
    expect(brandingUpdateSchema.safeParse({}).success).toBe(false);
  });
});

describe("categoryBrandingSchema", () => {
  it("accepts appearance subset and nullable icon", () => {
    expect(
      categoryBrandingSchema.safeParse({
        icon_url: null,
        appearance: { backgroundColor: "#112233", borderRadius: "2xl", animationEnabled: false },
      }).success
    ).toBe(true);
  });

  it("rejects unknown radius/shadow enums and empty patch", () => {
    expect(
      categoryBrandingSchema.safeParse({ appearance: { borderRadius: "huge" } }).success
    ).toBe(false);
    expect(categoryBrandingSchema.safeParse({}).success).toBe(false);
  });
});

describe("categoryOrderSchema", () => {
  it("requires at least one uuid", () => {
    expect(categoryOrderSchema.safeParse({ ids: [] }).success).toBe(false);
    expect(categoryOrderSchema.safeParse({ ids: ["not-uuid"] }).success).toBe(false);
    expect(
      categoryOrderSchema.safeParse({ ids: ["123e4567-e89b-12d3-a456-426614174000"] }).success
    ).toBe(true);
  });
});
