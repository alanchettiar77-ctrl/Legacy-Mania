import { resolveHeroTileHref } from "@/lib/utils/hero-tile-link";

describe("resolveHeroTileHref", () => {
  it("builds /catalog/:slug for category links", () => {
    expect(resolveHeroTileHref({ link_type: "category", link_value: "pokemon" })).toBe("/catalog/pokemon");
  });

  it("builds /products/:slug for product links", () => {
    expect(resolveHeroTileHref({ link_type: "product", link_value: "charizard-holo" })).toBe(
      "/products/charizard-holo"
    );
  });

  it("uses link_value verbatim for custom_url links", () => {
    expect(resolveHeroTileHref({ link_type: "custom_url", link_value: "/about" })).toBe("/about");
  });

  it("falls back to link_value for reserved future link types", () => {
    expect(resolveHeroTileHref({ link_type: "collection", link_value: "/collections/new" })).toBe(
      "/collections/new"
    );
    expect(resolveHeroTileHref({ link_type: "search", link_value: "/search?q=holo" })).toBe(
      "/search?q=holo"
    );
    expect(resolveHeroTileHref({ link_type: "page", link_value: "/pages/faq" })).toBe("/pages/faq");
  });

  it("resolves a non-card, arbitrary future collection slug exactly like an anime one", () => {
    // Same code path used for "pokemon" must work unmodified for any future
    // non-card collection (e.g. a T-Shirts line) — proves no franchise-specific
    // branching exists anywhere in link resolution.
    expect(resolveHeroTileHref({ link_type: "category", link_value: "t-shirts-men-hoodies" })).toBe(
      "/catalog/t-shirts-men-hoodies"
    );
  });
});
