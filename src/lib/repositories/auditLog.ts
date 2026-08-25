import { appendRow, readAllRows } from "@/lib/googleSheets";
import { AUDIT_LOG_HEADERS, TABS } from "@/lib/sheetSchemas";
import { generateId } from "@/lib/id";
import type { AuditLogRow } from "@/types";

export async function logAudit(
  actorEmail: string,
  action: string,
  entityType: string,
  entityId: string,
  details = ""
): Promise<void> {
  const row: AuditLogRow = {
    id: generateId("log"),
    timestamp: new Date().toISOString(),
    actorEmail,
    action,
    entityType,
    entityId,
    details,
  };
  // Audit logging must never block or fail the primary request.
  try {
    await appendRow(TABS.AUDIT_LOG, AUDIT_LOG_HEADERS, row);
  } catch (err) {
    console.error("Failed to write audit log entry:", err);
  }
}

export async function listRecentAuditLog(limit = 200): Promise<AuditLogRow[]> {
  const rows = await readAllRows(TABS.AUDIT_LOG, AUDIT_LOG_HEADERS);
  return rows
    .map((r) => ({
      id: String(r.id ?? ""),
      timestamp: String(r.timestamp ?? ""),
      actorEmail: String(r.actorEmail ?? ""),
      action: String(r.action ?? ""),
      entityType: String(r.entityType ?? ""),
      entityId: String(r.entityId ?? ""),
      details: String(r.details ?? ""),
    }))
    .sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1))
    .slice(0, limit);
}
