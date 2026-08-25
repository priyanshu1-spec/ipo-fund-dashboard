import { appendRow, deleteRow, readAllRows, updateRow } from "@/lib/googleSheets";
import { INVESTOR_HEADERS, TABS } from "@/lib/sheetSchemas";
import { generateId } from "@/lib/id";
import type { InvestorRow } from "@/types";

function toInvestor(r: Record<string, unknown>): InvestorRow {
  return {
    id: String(r.id ?? ""),
    name: String(r.name ?? ""),
    relationship: String(r.relationship ?? ""),
    phone: String(r.phone ?? ""),
    email: String(r.email ?? ""),
    defaultBankAccount: String(r.defaultBankAccount ?? ""),
    defaultBankIfsc: String(r.defaultBankIfsc ?? ""),
    demandAccountNumber: String(r.demandAccountNumber ?? ""),
    panMasked: String(r.panMasked ?? ""),
    status: (r.status as InvestorRow["status"]) || "Active",
    createdAt: String(r.createdAt ?? ""),
    notes: String(r.notes ?? ""),
  };
}

export async function listInvestors(): Promise<InvestorRow[]> {
  const rows = await readAllRows(TABS.INVESTORS, INVESTOR_HEADERS);
  return rows.map(toInvestor).sort((a, b) => a.name.localeCompare(b.name));
}

export async function getInvestor(id: string): Promise<InvestorRow | undefined> {
  const rows = await listInvestors();
  return rows.find((r) => r.id === id);
}

export async function createInvestor(input: Partial<InvestorRow>): Promise<InvestorRow> {
  const investor: InvestorRow = {
    id: generateId("inv"),
    name: input.name ?? "",
    relationship: input.relationship ?? "",
    phone: input.phone ?? "",
    email: input.email ?? "",
    defaultBankAccount: input.defaultBankAccount ?? "",
    defaultBankIfsc: input.defaultBankIfsc ?? "",
    demandAccountNumber: input.demandAccountNumber ?? "",
    panMasked: input.panMasked ?? "",
    status: input.status ?? "Active",
    createdAt: new Date().toISOString(),
    notes: input.notes ?? "",
  };
  await appendRow(TABS.INVESTORS, INVESTOR_HEADERS, investor);
  return investor;
}

export async function updateInvestor(
  id: string,
  patch: Partial<InvestorRow>
): Promise<InvestorRow> {
  const rows = await readAllRows(TABS.INVESTORS, INVESTOR_HEADERS);
  const existing = rows.find((r) => r.id === id);
  if (!existing) throw new Error(`Investor ${id} not found`);
  const merged = { ...toInvestor(existing), ...patch, id };
  await updateRow(TABS.INVESTORS, INVESTOR_HEADERS, existing._rowNumber, merged);
  return merged;
}

export async function deleteInvestor(id: string): Promise<void> {
  const rows = await readAllRows(TABS.INVESTORS, INVESTOR_HEADERS);
  const existing = rows.find((r) => r.id === id);
  if (!existing) return;
  await deleteRow(TABS.INVESTORS, existing._rowNumber);
}
