import { bannerCreateSchema, bannerUpdateSchema, bannerReorderSchema } from "@/lib/validation/banner";

const validBanner = {
  title: "Summer Sale",
  desktop_image_url: "https://example.com/desktop.webp",
  alt_text: "Summer sale banner",
};

describe("bannerCreateSchema", () => {
  it("accepts a minimal valid banner", () => {
    const result = bannerCreateSchema.safeParse(validBanner);
    expect(result.success).toBe(true);
  });

  it("rejects a banner with no title", () => {
    const result = bannerCreateSchema.safeParse({ ...validBanner, title: "" });
    expect(result.success).toBe(false);
  });

  it("rejects a banner with no alt_text", () => {
    const { alt_text: _unused, ...rest } = validBanner;
    const result = bannerCreateSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects end_date before start_date", () => {
    const result = bannerCreateSchema.safeParse({
      ...validBanner,
      start_date: "2026-08-01T00:00:00Z",
      end_date: "2026-07-01T00:00:00Z",
    });
    expect(result.success).toBe(false);
  });

  it("rejects overlay_opacity outside 0-1", () => {
    const result = bannerCreateSchema.safeParse({ ...validBanner, overlay_opacity: 1.5 });
    expect(result.success).toBe(false);
  });

  it("rejects a cta_url that isn't relative or http(s)", () => {
    const result = bannerCreateSchema.safeParse({ ...validBanner, cta_url: "javascript:alert(1)" });
    expect(result.success).toBe(false);
  });

  it("accepts a relative cta_url", () => {
    const result = bannerCreateSchema.safeParse({ ...validBanner, cta_url: "/catalog/pokemon" });
    expect(result.success).toBe(true);
  });
});

describe("bannerUpdateSchema", () => {
  it("accepts a partial patch", () => {
    const result = bannerUpdateSchema.safeParse({ is_active: false });
    expect(result.success).toBe(true);
  });

  it("rejects an empty patch", () => {
    const result = bannerUpdateSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe("bannerReorderSchema", () => {
  it("accepts an array of uuids", () => {
    const result = bannerReorderSchema.safeParse({
      ids: ["550e8400-e29b-41d4-a716-446655440000"],
    });
    expect(result.success).toBe(true);
  });

  it("rejects an empty array", () => {
    const result = bannerReorderSchema.safeParse({ ids: [] });
    expect(result.success).toBe(false);
  });
});
