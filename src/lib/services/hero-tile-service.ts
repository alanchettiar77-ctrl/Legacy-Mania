import {
  listHeroTiles,
  listActiveHeroTiles,
  getHeroTile,
  getMaxDisplayOrder,
  insertHeroTile,
  updateHeroTile as repoUpdate,
  softDeleteHeroTile,
  reorderHeroTiles,
  type HeroTileRow,
} from "@/lib/repositories/hero-tile-repository";
import type { HeroTileCreateInput, HeroTileUpdateInput } from "@/lib/validation/hero-tile";
import { resolveHeroTileHref } from "@/lib/utils/hero-tile-link";
import { DEFAULT_HERO_TILES, type HeroTileDisplay } from "@/lib/utils/hero-tile-defaults";

export type { HeroTileRow };
// Re-exported for server-side consumers (API routes, page.tsx) that already import
// this service — HeroSection itself must import resolveHeroTileHref directly from
// @/lib/utils/hero-tile-link, never through this file (see Task 6).
export { resolveHeroTileHref };

/** Storefront feed. Never throws — the homepage must render without hero tiles if
 * Supabase is unreachable or this migration hasn't been applied yet (matches
 * getHomepageBanners / getHomepageNotifications). Three-way outcome:
 * - active rows exist -> return them
 * - zero active rows AND zero rows total (nothing ever configured) -> DEFAULT_HERO_TILES
 * - zero active rows but rows DO exist (admin deliberately hid/deleted everything) -> []
 * - any failure (unreachable, migration missing) -> DEFAULT_HERO_TILES, never throws */
export async function getHomepageHeroTiles(): Promise<HeroTileDisplay[]> {
  try {
    const active = await listActiveHeroTiles();
    if (active.length > 0) return active;
    const total = await listHeroTiles();
    return total.length === 0 ? DEFAULT_HERO_TILES : [];
  } catch (error) {
    console.error("Failed to load homepage hero tiles", error);
    return DEFAULT_HERO_TILES;
  }
}

export async function listAllHeroTiles(): Promise<HeroTileRow[]> {
  return listHeroTiles();
}

export async function createHeroTile(
  input: HeroTileCreateInput,
  adminId: string
): Promise<HeroTileRow> {
  const display_order = input.display_order ?? (await getMaxDisplayOrder()) + 1;
  return insertHeroTile({
    ...input,
    display_order,
    created_by: adminId,
    updated_by: adminId,
  });
}

export async function updateHeroTileById(
  id: string,
  patch: HeroTileUpdateInput,
  adminId: string
): Promise<HeroTileRow | null> {
  return repoUpdate(id, { ...patch, updated_by: adminId });
}

export async function deleteHeroTile(id: string, adminId: string): Promise<boolean> {
  return softDeleteHeroTile(id, adminId);
}

export async function reorder(ids: string[], adminId: string): Promise<void> {
  return reorderHeroTiles(ids, adminId);
}

export { getHeroTile };
