import { DEFAULT_HERO_TILES } from "./hero-tile-defaults";

describe("DEFAULT_HERO_TILES", () => {
  it("has exactly 4 entries", () => {
    expect(DEFAULT_HERO_TILES).toHaveLength(4);
  });

  it("is all active", () => {
    expect(DEFAULT_HERO_TILES.every((t) => t.is_active === true)).toBe(true);
  });

  it("all link to a category", () => {
    expect(DEFAULT_HERO_TILES.every((t) => t.link_type === "category")).toBe(true);
  });

  it("has unique link_values", () => {
    const values = DEFAULT_HERO_TILES.map((t) => t.link_value);
    expect(new Set(values).size).toBe(values.length);
  });
});
