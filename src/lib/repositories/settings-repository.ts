const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;

const HEADERS = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  "Content-Type": "application/json",
};

export async function upsertSetting(key: string, value: string): Promise<void> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/settings?on_conflict=key`, {
    method: "POST",
    headers: { ...HEADERS, Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({ key, value }),
  });
  if (!res.ok) throw new Error(`Failed to save setting "${key}": ${res.status}`);
}
