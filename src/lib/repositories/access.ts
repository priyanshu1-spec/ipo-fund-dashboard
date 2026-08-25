import { appendRow, deleteRow, readAllRows, updateRow } from "@/lib/googleSheets";
import { ACCESS_CONTROL_HEADERS, TABS } from "@/lib/sheetSchemas";
import { generateId } from "@/lib/id";
import type { AccessControlRow, UserRole } from "@/types";

function toAccess(r: Record<string, unknown>): AccessControlRow {
  return {
    id: String(r.id ?? ""),
    email: String(r.email ?? "").toLowerCase().trim(),
    role: (r.role as UserRole) || "viewer",
    status: (r.status as AccessControlRow["status"]) || "active",
    addedBy: String(r.addedBy ?? ""),
    addedAt: String(r.addedAt ?? ""),
    notes: String(r.notes ?? ""),
  };
}

export async function listAccessRows(): Promise<AccessControlRow[]> {
  const rows = await readAllRows(TABS.ACCESS_CONTROL, ACCESS_CONTROL_HEADERS);
  return rows.map(toAccess);
}

export async function findAccessByEmail(email: string): Promise<AccessControlRow | undefined> {
  const rows = await listAccessRows();
  return rows.find((r) => r.email === email.toLowerCase().trim());
}

export async function grantAccess(
  email: string,
  role: UserRole,
  addedBy: string,
  notes = ""
): Promise<AccessControlRow> {
  const existing = await findAccessByEmail(email);
  if (existing) {
    return updateAccess(existing.id, { role, status: "active", notes });
  }
  const row: AccessControlRow = {
    id: generateId("acc"),
    email: email.toLowerCase().trim(),
    role,
    status: "active",
    addedBy,
    addedAt: new Date().toISOString(),
    notes,
  };
  await appendRow(TABS.ACCESS_CONTROL, ACCESS_CONTROL_HEADERS, row);
  return row;
}

export async function updateAccess(
  id: string,
  patch: Partial<AccessControlRow>
): Promise<AccessControlRow> {
  const rows = await readAllRows(TABS.ACCESS_CONTROL, ACCESS_CONTROL_HEADERS);
  const existing = rows.find((r) => r.id === id);
  if (!existing) throw new Error(`Access row ${id} not found`);
  const merged = { ...toAccess(existing), ...patch, id };
  await updateRow(TABS.ACCESS_CONTROL, ACCESS_CONTROL_HEADERS, existing._rowNumber, merged);
  return merged;
}

export async function revokeAccess(id: string): Promise<AccessControlRow> {
  return updateAccess(id, { status: "revoked" });
}

export async function deleteAccessRow(id: string): Promise<void> {
  const rows = await readAllRows(TABS.ACCESS_CONTROL, ACCESS_CONTROL_HEADERS);
  const existing = rows.find((r) => r.id === id);
  if (!existing) return;
  await deleteRow(TABS.ACCESS_CONTROL, existing._rowNumber);
}
