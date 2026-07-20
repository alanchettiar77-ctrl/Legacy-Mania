const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;

export interface RecordLoginAttemptInput {
  identifier: string;
  ip: string;
  succeeded: boolean;
}

export async function recordLoginAttempt(input: RecordLoginAttemptInput): Promise<void> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/login_attempts`, {
    method: "POST",
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`Failed to record login attempt: ${res.status}`);
}

export interface LoginAttemptRow {
  succeeded: boolean;
  created_at: string;
}

export async function getRecentAttempts(identifier: string, limit: number): Promise<LoginAttemptRow[]> {
  const params = new URLSearchParams();
  params.set("identifier", `eq.${identifier}`);
  params.set("select", "succeeded,created_at");
  params.set("order", "created_at.desc");
  params.set("limit", String(limit));

  const res = await fetch(`${SUPABASE_URL}/rest/v1/login_attempts?${params.toString()}`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
    cache: "no-store",
  });
  if (!res.ok) return [];
  return res.json();
}
