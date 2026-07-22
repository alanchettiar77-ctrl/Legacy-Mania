const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;

const HEADERS = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  "Content-Type": "application/json",
};
const WRITE_HEADERS = { ...HEADERS, Prefer: "return=representation" };

const TABLE = `${SUPABASE_URL}/rest/v1/banners`;

export interface BannerRow {
  id: string;
  title: string;
  subtitle: string | null;
  cta_text: string | null;
  cta_url: string | null;
  category_id: string | null;
  desktop_image_url: string;
  mobile_image_url: string | null;
  alt_text: string;
  aria_label: string | null;
  image_title: string | null;
  overlay_enabled: boolean;
  overlay_opacity: number;
  banner_type: string;
  video_url: string | null;
  display_order: number;
  is_active: boolean;
  start_date: string | null;
  end_date: string | null;
  seo_meta_title: string | null;
  seo_meta_description: string | null;
  seo_keywords: string | null;
  og_title: string | null;
  og_description: string | null;
  og_image_url: string | null;
  canonical_url: string | null;
  schema_type: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

/** All non-deleted rows for the admin panel, in display order. */
export async function listBanners(): Promise<BannerRow[]> {
  const res = await fetch(`${TABLE}?deleted_at=is.null&order=display_order.asc`, {
    headers: HEADERS,
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Failed to list banners: ${res.status}`);
  return res.json();
}

/** Live rows for the storefront: active, not deleted, inside schedule window. */
export async function listActiveBanners(nowIso: string): Promise<BannerRow[]> {
  const params = new URLSearchParams();
  params.set("is_active", "eq.true");
  params.set("deleted_at", "is.null");
  params.append("or", `(start_date.is.null,start_date.lte.${nowIso})`);
  params.append("or", `(end_date.is.null,end_date.gte.${nowIso})`);
  params.set("order", "display_order.asc");

  const res = await fetch(`${TABLE}?${params.toString()}`, { headers: HEADERS, cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to list active banners: ${res.status}`);
  return res.json();
}

export async function getBanner(id: string): Promise<BannerRow | null> {
  const res = await fetch(`${TABLE}?id=eq.${encodeURIComponent(id)}&deleted_at=is.null&limit=1`, {
    headers: HEADERS,
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Failed to get banner: ${res.status}`);
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

export async function insertBanner(values: Record<string, unknown>): Promise<BannerRow> {
  const res = await fetch(TABLE, {
    method: "POST",
    headers: WRITE_HEADERS,
    body: JSON.stringify(values),
  });
  if (!res.ok) throw new Error(`Failed to insert banner: ${res.status}`);
  const rows = await res.json();
  return rows[0];
}

export async function updateBanner(
  id: string,
  patch: Record<string, unknown>
): Promise<BannerRow | null> {
  const res = await fetch(`${TABLE}?id=eq.${encodeURIComponent(id)}&deleted_at=is.null`, {
    method: "PATCH",
    headers: WRITE_HEADERS,
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error(`Failed to update banner: ${res.status}`);
  const rows = await res.json();
  return rows[0] ?? null;
}

export async function softDeleteBanner(id: string, userId: string): Promise<boolean> {
  const row = await updateBanner(id, { deleted_at: new Date().toISOString(), updated_by: userId });
  return row !== null;
}

/** Rewrites display_order to match the given id order (0..n-1). */
export async function reorderBanners(ids: string[], userId: string): Promise<void> {
  for (let i = 0; i < ids.length; i++) {
    const res = await fetch(`${TABLE}?id=eq.${encodeURIComponent(ids[i])}&deleted_at=is.null`, {
      method: "PATCH",
      headers: HEADERS,
      body: JSON.stringify({ display_order: i, updated_by: userId }),
    });
    if (!res.ok) throw new Error(`Failed to reorder banner ${ids[i]}: ${res.status}`);
  }
}
