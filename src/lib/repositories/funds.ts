import { ensureSchema, sql } from "@/lib/db";
import { generateId, num } from "@/lib/id";
import type { FundAllocationRow } from "@/types";

function toFund(r: Record<string, unknown>): FundAllocationRow {
  return {
    id: String(r.id ?? ""),
    applicationId: String(r.application_id ?? ""),
    ipoName: String(r.ipo_name ?? ""),
    investorId: String(r.investor_id ?? ""),
    investorName: String(r.investor_name ?? ""),
    source: (r.source as FundAllocationRow["source"]) || "Self",
    amountContributed: num(r.amount_contributed),
    dateReceived: String(r.date_received ?? ""),
    repaymentBankAccount: String(r.repayment_bank_account ?? ""),
    amountRepaid: num(r.amount_repaid),
    repaymentDate: String(r.repayment_date ?? ""),
    profitShareAmount: num(r.profit_share_amount),
    profitShareStatus: (r.profit_share_status as FundAllocationRow["profitShareStatus"]) || "N/A",
    createdAt: String(r.created_at ?? ""),
    notes: String(r.notes ?? ""),
  };
}

export async function listFundAllocations(): Promise<FundAllocationRow[]> {
  await ensureSchema();
  const { rows } = await sql`SELECT * FROM fund_allocations ORDER BY created_at DESC NULLS LAST`;
  return rows.map(toFund);
}

export async function listFundAllocationsForApplication(
  applicationId: string
): Promise<FundAllocationRow[]> {
  await ensureSchema();
  const { rows } = await sql`SELECT * FROM fund_allocations WHERE application_id = ${applicationId}`;
  return rows.map(toFund);
}

export async function getFundAllocation(id: string): Promise<FundAllocationRow | undefined> {
  await ensureSchema();
  const { rows } = await sql`SELECT * FROM fund_allocations WHERE id = ${id}`;
  return rows[0] ? toFund(rows[0]) : undefined;
}

export async function createFundAllocation(
  input: Partial<FundAllocationRow>
): Promise<FundAllocationRow> {
  await ensureSchema();
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
  await sql`
    INSERT INTO fund_allocations (
      id, application_id, ipo_name, investor_id, investor_name, source, amount_contributed,
      date_received, repayment_bank_account, amount_repaid, repayment_date, profit_share_amount,
      profit_share_status, created_at, notes
    ) VALUES (
      ${fund.id}, ${fund.applicationId}, ${fund.ipoName}, ${fund.investorId}, ${fund.investorName},
      ${fund.source}, ${fund.amountContributed}, ${fund.dateReceived}, ${fund.repaymentBankAccount},
      ${fund.amountRepaid}, ${fund.repaymentDate}, ${fund.profitShareAmount}, ${fund.profitShareStatus},
      ${fund.createdAt}, ${fund.notes}
    )
  `;
  return fund;
}

export async function updateFundAllocation(
  id: string,
  patch: Partial<FundAllocationRow>
): Promise<FundAllocationRow> {
  await ensureSchema();
  const existing = await getFundAllocation(id);
  if (!existing) throw new Error(`Fund allocation ${id} not found`);
  const merged: FundAllocationRow = { ...existing, ...patch, id };
  await sql`
    UPDATE fund_allocations SET
      application_id = ${merged.applicationId}, ipo_name = ${merged.ipoName},
      investor_id = ${merged.investorId}, investor_name = ${merged.investorName},
      source = ${merged.source}, amount_contributed = ${merged.amountContributed},
      date_received = ${merged.dateReceived}, repayment_bank_account = ${merged.repaymentBankAccount},
      amount_repaid = ${merged.amountRepaid}, repayment_date = ${merged.repaymentDate},
      profit_share_amount = ${merged.profitShareAmount}, profit_share_status = ${merged.profitShareStatus},
      notes = ${merged.notes}
    WHERE id = ${id}
  `;
  return merged;
}

export async function deleteFundAllocation(id: string): Promise<void> {
  await ensureSchema();
  await sql`DELETE FROM fund_allocations WHERE id = ${id}`;
}
