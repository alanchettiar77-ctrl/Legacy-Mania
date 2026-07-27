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

export type { HeroTileRow };
// Re-exported for server-side consumers (API routes, page.tsx) that already import
// this service — HeroSection itself must import resolveHeroTileHref directly from
// @/lib/utils/hero-tile-link, never through this file (see Task 6).
export { resolveHeroTileHref };

/** Storefront feed. Never throws — the homepage must render without hero tiles if
 * Supabase is unreachable or this migration hasn't been applied yet (matches
 * getHomepageBanners / getHomepageNotifications). */
export async function getHomepageHeroTiles(): Promise<HeroTileRow[]> {
  try {
    return await listActiveHeroTiles();
  } catch (error) {
    console.error("Failed to load homepage hero tiles", error);
    return [];
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
