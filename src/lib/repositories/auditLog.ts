import { ensureSchema, sql } from "@/lib/db";
import { generateId } from "@/lib/id";
import type { AuditLogRow } from "@/types";

export async function logAudit(
  actor: string,
  action: string,
  entityType: string,
  entityId: string,
  details = ""
): Promise<void> {
  const row: AuditLogRow = {
    id: generateId("log"),
    timestamp: new Date().toISOString(),
    actor,
    action,
    entityType,
    entityId,
    details,
  };
  // Audit logging must never block or fail the primary request.
  try {
    await ensureSchema();
    await sql`
      INSERT INTO audit_log (id, "timestamp", actor, action, entity_type, entity_id, details)
      VALUES (${row.id}, ${row.timestamp}, ${row.actor}, ${row.action}, ${row.entityType}, ${row.entityId}, ${row.details})
    `;
  } catch (err) {
    console.error("Failed to write audit log entry:", err);
  }
}

export async function listRecentAuditLog(limit = 200): Promise<AuditLogRow[]> {
  await ensureSchema();
  const { rows } = await sql`
    SELECT * FROM audit_log ORDER BY "timestamp" DESC LIMIT ${limit}
  `;
  return rows.map((r: Record<string, unknown>) => ({
    id: String(r.id ?? ""),
    timestamp: String(r.timestamp ?? ""),
    actor: String(r.actor ?? ""),
    action: String(r.action ?? ""),
    entityType: String(r.entity_type ?? ""),
    entityId: String(r.entity_id ?? ""),
    details: String(r.details ?? ""),
  }));
}
