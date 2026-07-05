import {
  insertAuditLog,
  queryAuditLogs,
  type InsertAuditLogInput,
  type QueryAuditLogsFilters,
  type AuditLogRow,
} from "@/lib/repositories/audit-repository";

export type RecordAuditLogInput = InsertAuditLogInput;

/**
 * Records an audit log entry. Never throws — a failed audit write must not break the
 * calling mutation (e.g. a banner should still be created even if this insert fails).
 */
export async function recordAuditLog(input: RecordAuditLogInput): Promise<void> {
  try {
    await insertAuditLog(input);
  } catch (error) {
    console.error("Failed to record audit log", error);
  }
}

export async function queryAuditLog(filters: QueryAuditLogsFilters): Promise<AuditLogRow[]> {
  return queryAuditLogs(filters);
}
