const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;

const HEADERS = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  "Content-Type": "application/json",
};
const WRITE_HEADERS = { ...HEADERS, Prefer: "return=representation" };

const TABLE = `${SUPABASE_URL}/rest/v1/homepage_notifications`;

export interface NotificationRow {
  id: string;
  title: string;
  message: string;
  short_message: string | null;
  type: string;
  cta_text: string | null;
  cta_url: string | null;
  priority: number;
  display_order: number;
  is_active: boolean;
  theme: string;
  icon: string | null;
  animation: string;
  background_color: string | null;
  text_color: string | null;
  start_date: string | null;
  end_date: string | null;
  device: string;
  target_audience: unknown;
  country: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

/** All non-deleted rows for the admin panel, priority desc then display_order asc. */
export async function listNotifications(): Promise<NotificationRow[]> {
  const res = await fetch(
    `${TABLE}?deleted_at=is.null&order=priority.desc,display_order.asc`,
    { headers: HEADERS, cache: "no-store" }
  );
  if (!res.ok) throw new Error(`Failed to list notifications: ${res.status}`);
  return res.json();
}

/** Live rows for the storefront: active, not deleted, inside schedule window, matching device. */
export async function listActiveNotifications(
  nowIso: string,
  device: "desktop" | "mobile" | "both"
): Promise<NotificationRow[]> {
  const params = new URLSearchParams();
  params.set("is_active", "eq.true");
  params.set("deleted_at", "is.null");
  params.append("or", `(start_date.is.null,start_date.lte.${nowIso})`);
  params.append("or", `(end_date.is.null,end_date.gte.${nowIso})`);
  if (device !== "both") params.append("device", `in.(both,${device})`);
  params.set("order", "priority.desc,display_order.asc");

  const res = await fetch(`${TABLE}?${params.toString()}`, { headers: HEADERS, cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to list active notifications: ${res.status}`);
  return res.json();
}

export async function getNotification(id: string): Promise<NotificationRow | null> {
  const res = await fetch(`${TABLE}?id=eq.${encodeURIComponent(id)}&deleted_at=is.null&limit=1`, {
    headers: HEADERS,
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Failed to get notification: ${res.status}`);
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

export async function insertNotification(
  values: Record<string, unknown>
): Promise<NotificationRow> {
  const res = await fetch(TABLE, {
    method: "POST",
    headers: WRITE_HEADERS,
    body: JSON.stringify(values),
  });
  if (!res.ok) throw new Error(`Failed to insert notification: ${res.status}`);
  const rows = await res.json();
  return rows[0];
}

export async function updateNotification(
  id: string,
  patch: Record<string, unknown>
): Promise<NotificationRow | null> {
  const res = await fetch(`${TABLE}?id=eq.${encodeURIComponent(id)}&deleted_at=is.null`, {
    method: "PATCH",
    headers: WRITE_HEADERS,
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error(`Failed to update notification: ${res.status}`);
  const rows = await res.json();
  return rows[0] ?? null;
}

export async function softDeleteNotification(id: string, userId: string): Promise<boolean> {
  const row = await updateNotification(id, {
    deleted_at: new Date().toISOString(),
    updated_by: userId,
  });
  return row !== null;
}

/** Rewrites display_order to match the given id order (0..n-1). */
export async function reorderNotifications(ids: string[], userId: string): Promise<void> {
  for (let i = 0; i < ids.length; i++) {
    const res = await fetch(`${TABLE}?id=eq.${encodeURIComponent(ids[i])}&deleted_at=is.null`, {
      method: "PATCH",
      headers: HEADERS,
      body: JSON.stringify({ display_order: i, updated_by: userId }),
    });
    if (!res.ok) throw new Error(`Failed to reorder notification ${ids[i]}: ${res.status}`);
  }
}

// ---- Display settings (stored in the existing settings table) ----

const SETTINGS_KEY = "homepage_notifications_display";
const SETTINGS_URL = `${SUPABASE_URL}/rest/v1/settings`;

export async function getDisplaySettings(): Promise<Record<string, unknown> | null> {
  const res = await fetch(`${SETTINGS_URL}?key=eq.${SETTINGS_KEY}&select=value&limit=1`, {
    headers: HEADERS,
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Failed to get display settings: ${res.status}`);
  const rows = await res.json();
  return rows?.[0]?.value ?? null;
}

export async function updateDisplaySettings(
  value: Record<string, unknown>,
  userId: string
): Promise<void> {
  const res = await fetch(`${SETTINGS_URL}?key=eq.${SETTINGS_KEY}`, {
    method: "PATCH",
    headers: HEADERS,
    body: JSON.stringify({ value, updated_by: userId }),
  });
  if (!res.ok) throw new Error(`Failed to update display settings: ${res.status}`);
}
