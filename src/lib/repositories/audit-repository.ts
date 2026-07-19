const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;

export interface AuditLogRow {
  id: string;
  user_id: string | null;
  action: string;
  table_name: string;
  record_id: string | null;
  old_values: unknown;
  new_values: unknown;
  ip_address: string | null;
  created_at: string;
}

export interface InsertAuditLogInput {
  /** Omit for anonymous events (e.g. failed auth attempts) — stored as NULL. */
  userId?: string;
  action: string;
  tableName: string;
  recordId?: string;
  oldValues?: unknown;
  newValues?: unknown;
}

export async function insertAuditLog(input: InsertAuditLogInput): Promise<void> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/audit_logs`, {
    method: "POST",
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      user_id: input.userId ?? null,
      action: input.action,
      table_name: input.tableName,
      record_id: input.recordId ?? null,
      old_values: input.oldValues ?? null,
      new_values: input.newValues ?? null,
    }),
  });
  if (!res.ok) throw new Error(`Failed to write audit log: ${res.status}`);
}

export interface QueryAuditLogsFilters {
  userId?: string;
  tableName?: string;
  action?: string;
  dateFrom?: string;
  dateTo?: string;
}

export async function queryAuditLogs(filters: QueryAuditLogsFilters): Promise<AuditLogRow[]> {
  const params = new URLSearchParams();
  params.set("select", "*");
  params.set("order", "created_at.desc");
  if (filters.userId) params.append("user_id", `eq.${filters.userId}`);
  if (filters.tableName) params.append("table_name", `eq.${filters.tableName}`);
  if (filters.action) params.append("action", `eq.${filters.action}`);
  if (filters.dateFrom) params.append("created_at", `gte.${filters.dateFrom}`);
  if (filters.dateTo) params.append("created_at", `lte.${filters.dateTo}`);

  const res = await fetch(`${SUPABASE_URL}/rest/v1/audit_logs?${params.toString()}`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Failed to query audit logs: ${res.status}`);
  return res.json();
}
