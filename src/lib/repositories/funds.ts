import { appendRow, deleteRow, readAllRows, updateRow } from "@/lib/googleSheets";
import { FUND_ALLOCATION_HEADERS, TABS } from "@/lib/sheetSchemas";
import { generateId, num } from "@/lib/id";
import type { FundAllocationRow } from "@/types";

function toFund(r: Record<string, unknown>): FundAllocationRow {
  return {
    id: String(r.id ?? ""),
    applicationId: String(r.applicationId ?? ""),
    ipoName: String(r.ipoName ?? ""),
    investorId: String(r.investorId ?? ""),
    investorName: String(r.investorName ?? ""),
    source: (r.source as FundAllocationRow["source"]) || "Self",
    amountContributed: num(r.amountContributed),
    dateReceived: String(r.dateReceived ?? ""),
    repaymentBankAccount: String(r.repaymentBankAccount ?? ""),
    amountRepaid: num(r.amountRepaid),
    repaymentDate: String(r.repaymentDate ?? ""),
    profitShareAmount: num(r.profitShareAmount),
    profitShareStatus: (r.profitShareStatus as FundAllocationRow["profitShareStatus"]) || "N/A",
    createdAt: String(r.createdAt ?? ""),
    notes: String(r.notes ?? ""),
  };
}

export async function listFundAllocations(): Promise<FundAllocationRow[]> {
  const rows = await readAllRows(TABS.FUND_ALLOCATION, FUND_ALLOCATION_HEADERS);
  return rows.map(toFund).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export async function listFundAllocationsForApplication(
  applicationId: string
): Promise<FundAllocationRow[]> {
  const rows = await listFundAllocations();
  return rows.filter((r) => r.applicationId === applicationId);
}

export async function createFundAllocation(
  input: Partial<FundAllocationRow>
): Promise<FundAllocationRow> {
  const fund: FundAllocationRow = {
    id: generateId("fund"),
    applicationId: input.applicationId ?? "",
    ipoName: input.ipoName ?? "",
    investorId: input.investorId ?? "",
    investorName: input.investorName ?? "",
    source: input.source ?? "Self",
    amountContributed: input.amountContributed ?? 0,
    dateReceived: input.dateReceived ?? "",
    repaymentBankAccount: input.repaymentBankAccount ?? "",
    amountRepaid: input.amountRepaid ?? 0,
    repaymentDate: input.repaymentDate ?? "",
    profitShareAmount: input.profitShareAmount ?? 0,
    profitShareStatus: input.profitShareStatus ?? "N/A",
    createdAt: new Date().toISOString(),
    notes: input.notes ?? "",
  };
  await appendRow(TABS.FUND_ALLOCATION, FUND_ALLOCATION_HEADERS, fund);
  return fund;
}

export async function updateFundAllocation(
  id: string,
  patch: Partial<FundAllocationRow>
): Promise<FundAllocationRow> {
  const rows = await readAllRows(TABS.FUND_ALLOCATION, FUND_ALLOCATION_HEADERS);
  const existing = rows.find((r) => r.id === id);
  if (!existing) throw new Error(`Fund allocation ${id} not found`);
  const merged = { ...toFund(existing), ...patch, id };
  await updateRow(TABS.FUND_ALLOCATION, FUND_ALLOCATION_HEADERS, existing._rowNumber, merged);
  return merged;
}

export async function deleteFundAllocation(id: string): Promise<void> {
  const rows = await readAllRows(TABS.FUND_ALLOCATION, FUND_ALLOCATION_HEADERS);
  const existing = rows.find((r) => r.id === id);
  if (!existing) return;
  await deleteRow(TABS.FUND_ALLOCATION, existing._rowNumber);
}
