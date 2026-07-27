import { heroTileCreateSchema, heroTileUpdateSchema, heroTileReorderSchema } from "@/lib/validation/hero-tile";

describe("hero-tile validation", () => {
  it("accepts a minimal valid create payload", () => {
    const result = heroTileCreateSchema.safeParse({
      label: "Pikachu",
      icon_emoji: "⚡",
      link_value: "pokemon",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an empty label", () => {
    const result = heroTileCreateSchema.safeParse({ label: "", icon_emoji: "⚡", link_value: "pokemon" });
    expect(result.success).toBe(false);
  });

  it("rejects an unknown color_theme", () => {
    const result = heroTileCreateSchema.safeParse({
      label: "Pikachu",
      icon_emoji: "⚡",
      color_theme: "rainbow",
      link_value: "pokemon",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an unknown link_type", () => {
    const result = heroTileCreateSchema.safeParse({
      label: "Pikachu",
      icon_emoji: "⚡",
      link_type: "playlist",
      link_value: "pokemon",
    });
    expect(result.success).toBe(false);
  });

  it("accepts a custom_url link_value that is a relative path", () => {
    const result = heroTileCreateSchema.safeParse({
      label: "About Us",
      icon_emoji: "ℹ️",
      link_type: "custom_url",
      link_value: "/about",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an update payload with no fields", () => {
    const result = heroTileUpdateSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("accepts a partial update payload", () => {
    const result = heroTileUpdateSchema.safeParse({ is_active: false });
    expect(result.success).toBe(true);
  });

  it("reorder schema requires at least one uuid", () => {
    expect(heroTileReorderSchema.safeParse({ ids: [] }).success).toBe(false);
    expect(heroTileReorderSchema.safeParse({ ids: ["not-a-uuid"] }).success).toBe(false);
  });
});
