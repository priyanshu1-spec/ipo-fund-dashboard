import { appendRow, deleteRow, readAllRows, updateRow } from "@/lib/googleSheets";
import { APPLICATION_HEADERS, TABS } from "@/lib/sheetSchemas";
import { generateId, num } from "@/lib/id";
import type { ApplicationRow } from "@/types";

function toApplication(r: Record<string, unknown>): ApplicationRow {
  return {
    id: String(r.id ?? ""),
    ipoId: String(r.ipoId ?? ""),
    ipoName: String(r.ipoName ?? ""),
    appliedInNameOf: String(r.appliedInNameOf ?? ""),
    investorId: String(r.investorId ?? ""),
    panMasked: String(r.panMasked ?? ""),
    applicationNumber: String(r.applicationNumber ?? ""),
    upiId: String(r.upiId ?? ""),
    category: (r.category as ApplicationRow["category"]) || "Retail",
    lotsApplied: num(r.lotsApplied),
    amountBlocked: num(r.amountBlocked),
    paymentMode: (r.paymentMode as ApplicationRow["paymentMode"]) || "UPI",
    allotmentStatus: (r.allotmentStatus as ApplicationRow["allotmentStatus"]) || "Pending",
    lotsAllotted: num(r.lotsAllotted),
    amountAllotted: num(r.amountAllotted),
    refundAmount: num(r.refundAmount),
    refundStatus: (r.refundStatus as ApplicationRow["refundStatus"]) || "N/A",
    refundDate: String(r.refundDate ?? ""),
    sellDate: String(r.sellDate ?? ""),
    sellPrice: num(r.sellPrice),
    createdBy: String(r.createdBy ?? ""),
    createdAt: String(r.createdAt ?? ""),
    updatedAt: String(r.updatedAt ?? ""),
    notes: String(r.notes ?? ""),
  };
}

export async function listApplications(): Promise<ApplicationRow[]> {
  const rows = await readAllRows(TABS.APPLICATIONS, APPLICATION_HEADERS);
  return rows.map(toApplication).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export async function getApplication(id: string): Promise<ApplicationRow | undefined> {
  const rows = await listApplications();
  return rows.find((r) => r.id === id);
}

export async function createApplication(
  input: Partial<ApplicationRow>,
  createdBy: string
): Promise<ApplicationRow> {
  const now = new Date().toISOString();
  const app: ApplicationRow = {
    id: generateId("app"),
    ipoId: input.ipoId ?? "",
    ipoName: input.ipoName ?? "",
    appliedInNameOf: input.appliedInNameOf ?? "",
    investorId: input.investorId ?? "",
    panMasked: input.panMasked ?? "",
    applicationNumber: input.applicationNumber ?? "",
    upiId: input.upiId ?? "",
    category: input.category ?? "Retail",
    lotsApplied: input.lotsApplied ?? 0,
    amountBlocked: input.amountBlocked ?? 0,
    paymentMode: input.paymentMode ?? "UPI",
    allotmentStatus: input.allotmentStatus ?? "Pending",
    lotsAllotted: input.lotsAllotted ?? 0,
    amountAllotted: input.amountAllotted ?? 0,
    refundAmount: input.refundAmount ?? 0,
    refundStatus: input.refundStatus ?? "N/A",
    refundDate: input.refundDate ?? "",
    sellDate: input.sellDate ?? "",
    sellPrice: input.sellPrice ?? 0,
    createdBy,
    createdAt: now,
    updatedAt: now,
    notes: input.notes ?? "",
  };
  await appendRow(TABS.APPLICATIONS, APPLICATION_HEADERS, app);
  return app;
}

export async function updateApplication(
  id: string,
  patch: Partial<ApplicationRow>
): Promise<ApplicationRow> {
  const rows = await readAllRows(TABS.APPLICATIONS, APPLICATION_HEADERS);
  const existing = rows.find((r) => r.id === id);
  if (!existing) throw new Error(`Application ${id} not found`);
  const merged = {
    ...toApplication(existing),
    ...patch,
    id,
    updatedAt: new Date().toISOString(),
  };
  await updateRow(TABS.APPLICATIONS, APPLICATION_HEADERS, existing._rowNumber, merged);
  return merged;
}

export async function deleteApplication(id: string): Promise<void> {
  const rows = await readAllRows(TABS.APPLICATIONS, APPLICATION_HEADERS);
  const existing = rows.find((r) => r.id === id);
  if (!existing) return;
  await deleteRow(TABS.APPLICATIONS, existing._rowNumber);
}

/**
 * SEBI-style safeguard: flags when the same PAN is used for more than one
 * Retail-category application within the same IPO (which regulators reject
 * as a duplicate application and both get rejected).
 */
export function findDuplicatePanWarnings(
  applications: ApplicationRow[]
): { ipoId: string; ipoName: string; pan: string; applicationIds: string[] }[] {
  const groups = new Map<string, ApplicationRow[]>();
  for (const a of applications) {
    if (!a.panMasked) continue;
    const key = `${a.ipoId}::${a.panMasked}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(a);
  }
  const warnings: { ipoId: string; ipoName: string; pan: string; applicationIds: string[] }[] = [];
  for (const [, apps] of groups) {
    if (apps.length > 1) {
      warnings.push({
        ipoId: apps[0].ipoId,
        ipoName: apps[0].ipoName,
        pan: apps[0].panMasked,
        applicationIds: apps.map((a) => a.id),
      });
    }
  }
  return warnings;
}
