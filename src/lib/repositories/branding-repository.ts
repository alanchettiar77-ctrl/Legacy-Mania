const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;

const HEADERS = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  "Content-Type": "application/json",
};

const KEY = "branding";
const SETTINGS_URL = `${SUPABASE_URL}/rest/v1/settings`;

/**
 * Storefront read — ISR-cached for 5 minutes and tagged so admin updates can
 * revalidate instantly instead of waiting out the window.
 */
export async function getBrandingCached(): Promise<Record<string, unknown> | null> {
  const res = await fetch(`${SETTINGS_URL}?key=eq.${KEY}&select=value&limit=1`, {
    headers: HEADERS,
    next: { revalidate: 300, tags: ["branding"] },
  });
  if (!res.ok) throw new Error(`Failed to get branding: ${res.status}`);
  const rows = await res.json();
  return rows?.[0]?.value ?? null;
}

/** Admin read — always fresh. */
export async function getBrandingFresh(): Promise<Record<string, unknown> | null> {
  const res = await fetch(`${SETTINGS_URL}?key=eq.${KEY}&select=value&limit=1`, {
    headers: HEADERS,
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Failed to get branding: ${res.status}`);
  const rows = await res.json();
  return rows?.[0]?.value ?? null;
}

export async function updateBranding(
  value: Record<string, unknown>,
  userId: string
): Promise<void> {
  const res = await fetch(`${SETTINGS_URL}?key=eq.${KEY}`, {
    method: "PATCH",
    headers: HEADERS,
    body: JSON.stringify({ value, updated_by: userId }),
  });
  if (!res.ok) throw new Error(`Failed to update branding: ${res.status}`);
}
