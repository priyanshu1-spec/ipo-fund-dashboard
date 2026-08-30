import { ensureSchema, sql } from "@/lib/db";
import { generateId } from "@/lib/id";
import type { RegistrarRecord } from "@/types";

export type { RegistrarRecord };

function toRegistrar(r: Record<string, unknown>): RegistrarRecord {
  return {
    id: String(r.id ?? ""),
    matchKey: String(r.match_key ?? ""),
    displayName: String(r.display_name ?? ""),
    allotmentUrl: String(r.allotment_url ?? ""),
    verified: Boolean(r.verified),
    source: String(r.source ?? ""),
    createdAt: String(r.created_at ?? ""),
    updatedAt: String(r.updated_at ?? ""),
    updatedBy: String(r.updated_by ?? ""),
  };
}

export async function listRegistrars(): Promise<RegistrarRecord[]> {
  await ensureSchema();
  const { rows } = await sql`SELECT * FROM registrars ORDER BY verified ASC, display_name ASC`;
  return rows.map(toRegistrar);
}

/**
 * Matches a free-text registrar string (as it appears on an IPO row —
 * "KFin Technologies Limited", "Bigshare Services Pvt Ltd", etc.) against
 * the registrars table, case-insensitively, as a substring — exact
 * matching would miss most rows since providers/manual entry never use one
 * consistent legal name. Takes an already-fetched list so callers handling
 * many IPOs at once (the IPO list API, sync) only query the table once
 * rather than once per IPO.
 */
export function matchRegistrar(rawRegistrar: string, registrars: RegistrarRecord[]): RegistrarRecord | undefined {
  const normalized = rawRegistrar.trim().toLowerCase();
  if (!normalized) return undefined;
  return registrars.find((r) => r.matchKey && normalized.includes(r.matchKey));
}

/**
 * Inserts a placeholder row (verified = false, no URL yet) the first time
 * a registrar name is seen with no existing match — this is what makes it
 * show up in /admin as "New Registrar Detected" without needing a separate
 * notification mechanism. Idempotent: does nothing if that exact raw
 * string (as its own match_key) already has a row, whether still pending
 * or already verified by an admin, so a sync never overwrites an admin's
 * work or spams duplicate pending rows for the same registrar spelling.
 */
export async function upsertDetectedRegistrar(rawRegistrar: string): Promise<void> {
  await ensureSchema();
  const matchKey = rawRegistrar.trim().toLowerCase();
  if (!matchKey) return;
  const now = new Date().toISOString();
  const id = generateId("registrar");
  await sql`
    INSERT INTO registrars (id, match_key, display_name, allotment_url, verified, source, created_at, updated_at, updated_by)
    VALUES (${id}, ${matchKey}, ${rawRegistrar.trim()}, '', false, 'auto-detected', ${now}, ${now}, 'system')
    ON CONFLICT (match_key) DO NOTHING
  `;
}

/** Admin sets/edits a registrar's official allotment-status URL and marks it verified — the only way a registrar's link becomes clickable for users (see /api/ipos resolving against this table). */
export async function setRegistrarUrl(
  id: string,
  allotmentUrl: string,
  verified: boolean,
  updatedBy: string
): Promise<RegistrarRecord> {
  await ensureSchema();
  const now = new Date().toISOString();
  const { rows } = await sql`
    UPDATE registrars
    SET allotment_url = ${allotmentUrl}, verified = ${verified}, source = 'admin', updated_at = ${now}, updated_by = ${updatedBy}
    WHERE id = ${id}
    RETURNING *
  `;
  if (!rows[0]) throw new Error(`Registrar ${id} not found`);
  return toRegistrar(rows[0]);
}

export async function deleteRegistrar(id: string): Promise<void> {
  await ensureSchema();
  await sql`DELETE FROM registrars WHERE id = ${id}`;
}
