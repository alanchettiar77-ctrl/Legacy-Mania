export type HeroTileLinkType = "category" | "product" | "collection" | "search" | "page" | "custom_url";

export interface HeroTileLinkFields {
  link_type: HeroTileLinkType;
  link_value: string;
}

/**
 * Resolves a tile's link into a storefront href. Only `category` and `custom_url`
 * have dedicated destinations today; `product` maps to the existing product route.
 * `collection` / `search` / `page` are reserved for future modules (see the
 * generic-linking note in ROADMAP.md/AI_MEMORY.md) and, until those exist, fall back
 * to using link_value as a literal path.
 *
 * Deliberately dependency-free: this is imported directly by the "use client"
 * HeroSection component. Anything imported here must never touch
 * hero-tile-repository.ts or hero-tile-service.ts, which read
 * SUPABASE_SERVICE_ROLE_KEY at module scope and must stay server-only.
 */
export function resolveHeroTileHref(tile: HeroTileLinkFields): string {
  switch (tile.link_type) {
    case "category":
      return `/catalog/${tile.link_value}`;
    case "product":
      return `/products/${tile.link_value}`;
    case "custom_url":
    case "collection":
    case "search":
    case "page":
    default:
      return tile.link_value;
  }
}
