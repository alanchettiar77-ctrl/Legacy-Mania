const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;

const HEADERS = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  "Content-Type": "application/json",
};
const WRITE_HEADERS = { ...HEADERS, Prefer: "return=representation" };

const TABLE = `${SUPABASE_URL}/rest/v1/hero_tiles`;

export type ColorTheme = "sunrise" | "ember" | "citrus" | "blossom" | "ocean" | "violet";
export type LinkType = "category" | "product" | "collection" | "search" | "page" | "custom_url";

export interface HeroTileRow {
  id: string;
  label: string;
  icon_emoji: string;
  color_theme: ColorTheme;
  link_type: LinkType;
  link_value: string;
  display_order: number;
  is_active: boolean;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

/** All non-deleted rows for the admin panel, in display order. */
export async function listHeroTiles(): Promise<HeroTileRow[]> {
  const res = await fetch(`${TABLE}?deleted_at=is.null&order=display_order.asc`, {
    headers: HEADERS,
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Failed to list hero tiles: ${res.status}`);
  return res.json();
}

/** Live rows for the storefront: active and not deleted. */
export async function listActiveHeroTiles(): Promise<HeroTileRow[]> {
  const res = await fetch(
    `${TABLE}?is_active=eq.true&deleted_at=is.null&order=display_order.asc`,
    { headers: HEADERS, cache: "no-store" }
  );
  if (!res.ok) throw new Error(`Failed to list active hero tiles: ${res.status}`);
  return res.json();
}

export async function getHeroTile(id: string): Promise<HeroTileRow | null> {
  const res = await fetch(`${TABLE}?id=eq.${encodeURIComponent(id)}&deleted_at=is.null&limit=1`, {
    headers: HEADERS,
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Failed to get hero tile: ${res.status}`);
  const rows = await res.json();
  return rows[0] ?? null;
}

export async function getMaxDisplayOrder(): Promise<number> {
  const res = await fetch(
    `${TABLE}?deleted_at=is.null&select=display_order&order=display_order.desc&limit=1`,
    { headers: HEADERS, cache: "no-store" }
  );
  const rows = res.ok ? await res.json() : [];
  return rows?.[0]?.display_order ?? -1;
}

export async function insertHeroTile(values: Record<string, unknown>): Promise<HeroTileRow> {
  const res = await fetch(TABLE, {
    method: "POST",
    headers: WRITE_HEADERS,
    body: JSON.stringify(values),
  });
  if (!res.ok) throw new Error(`Failed to insert hero tile: ${res.status}`);
  const rows = await res.json();
  return rows[0];
}

export async function updateHeroTile(
  id: string,
  patch: Record<string, unknown>
): Promise<HeroTileRow | null> {
  const res = await fetch(`${TABLE}?id=eq.${encodeURIComponent(id)}&deleted_at=is.null`, {
    method: "PATCH",
    headers: WRITE_HEADERS,
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error(`Failed to update hero tile: ${res.status}`);
  const rows = await res.json();
  return rows[0] ?? null;
}

export async function softDeleteHeroTile(id: string, userId: string): Promise<boolean> {
  const row = await updateHeroTile(id, { deleted_at: new Date().toISOString(), updated_by: userId });
  return row !== null;
}

/** Rewrites display_order to match the given id order (0..n-1). */
export async function reorderHeroTiles(ids: string[], userId: string): Promise<void> {
  for (let i = 0; i < ids.length; i++) {
    const res = await fetch(`${TABLE}?id=eq.${encodeURIComponent(ids[i])}&deleted_at=is.null`, {
      method: "PATCH",
      headers: HEADERS,
      body: JSON.stringify({ display_order: i, updated_by: userId }),
    });
    if (!res.ok) throw new Error(`Failed to reorder hero tile ${ids[i]}: ${res.status}`);
  }
}
