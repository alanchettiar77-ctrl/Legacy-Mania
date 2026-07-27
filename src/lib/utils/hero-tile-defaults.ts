import type { HeroTileLinkFields } from "./hero-tile-link";

export interface HeroTileDisplay extends HeroTileLinkFields {
  id: string;
  label: string;
  icon_emoji: string;
  color_theme: string;
  display_order: number;
  is_active: boolean;
}

// Rendered only when NO hero tile rows exist yet in the database at all (fresh install,
// migration just applied, nobody has configured anything) or when the storefront feed
// call fails outright (Supabase unreachable, migration not applied). An admin who
// deliberately deactivates or deletes every tile gets a genuinely empty hero section —
// these defaults must never override that choice. See getHomepageHeroTiles() in
// hero-tile-service.ts, which is the only place that decides when these apply.
export const DEFAULT_HERO_TILES: HeroTileDisplay[] = [
  { id: "default-pikachu", label: "Pikachu", icon_emoji: "⚡", color_theme: "sunrise", link_type: "category", link_value: "pokemon", display_order: 0, is_active: true },
  { id: "default-goku", label: "Goku", icon_emoji: "🐉", color_theme: "ember", link_type: "category", link_value: "dragon-ball-z", display_order: 1, is_active: true },
  { id: "default-naruto", label: "Naruto", icon_emoji: "🍃", color_theme: "citrus", link_type: "category", link_value: "naruto", display_order: 2, is_active: true },
  { id: "default-luffy", label: "Luffy", icon_emoji: "⚓", color_theme: "blossom", link_type: "category", link_value: "one-piece", display_order: 3, is_active: true },
];
