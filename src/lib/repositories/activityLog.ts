import { ensureSchema, sql } from "@/lib/db";
import { generateId } from "@/lib/id";
import type { ActivityAction, ActivityLogEntry } from "@/types";

function toEntry(r: Record<string, unknown>): ActivityLogEntry {
  return {
    id: String(r.id ?? ""),
    userId: String(r.user_id ?? ""),
    userName: String(r.user_name ?? ""),
    action: (r.action as ActivityAction) || "create",
    entityType: String(r.entity_type ?? ""),
    entityId: String(r.entity_id ?? ""),
    entityLabel: String(r.entity_label ?? ""),
    details: String(r.details ?? ""),
    createdAt: String(r.created_at ?? ""),
  };
}

/** Records one create/update/delete for the activity log — best-effort: a logging failure never blocks the actual mutation that triggered it. */
export async function recordActivity(entry: {
  userId: string;
  userName: string;
  action: ActivityAction;
  entityType: string;
  entityId: string;
  entityLabel: string;
  details?: string;
}): Promise<void> {
  try {
    await ensureSchema();
    const id = generateId("act");
    const now = new Date().toISOString();
    await sql`
      INSERT INTO activity_log (id, user_id, user_name, action, entity_type, entity_id, entity_label, details, created_at)
      VALUES (${id}, ${entry.userId}, ${entry.userName}, ${entry.action}, ${entry.entityType}, ${entry.entityId}, ${entry.entityLabel}, ${entry.details ?? ""}, ${now})
    `;
  } catch {
    // Never let audit logging break the actual write it's logging.
  }
}

export async function listRecentActivity(limit = 200): Promise<ActivityLogEntry[]> {
  await ensureSchema();
  const { rows } = await sql`SELECT * FROM activity_log ORDER BY created_at DESC LIMIT ${limit}`;
  return rows.map(toEntry);
}
