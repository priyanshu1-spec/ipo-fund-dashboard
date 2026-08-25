import { ensureSchema, sql } from "@/lib/db";
import { generateId } from "@/lib/id";
import type { InvestorRow } from "@/types";

function toInvestor(r: Record<string, unknown>): InvestorRow {
  return {
    id: String(r.id ?? ""),
    name: String(r.name ?? ""),
    relationship: String(r.relationship ?? ""),
    phone: String(r.phone ?? ""),
    email: String(r.email ?? ""),
    defaultBankAccount: String(r.default_bank_account ?? ""),
    defaultBankIfsc: String(r.default_bank_ifsc ?? ""),
    demandAccountNumber: String(r.demand_account_number ?? ""),
    panMasked: String(r.pan_masked ?? ""),
    status: (r.status as InvestorRow["status"]) || "Active",
    createdAt: String(r.created_at ?? ""),
    notes: String(r.notes ?? ""),
  };
}

export async function listInvestors(): Promise<InvestorRow[]> {
  await ensureSchema();
  const { rows } = await sql`SELECT * FROM investors ORDER BY name ASC`;
  return rows.map(toInvestor);
}

export async function getInvestor(id: string): Promise<InvestorRow | undefined> {
  await ensureSchema();
  const { rows } = await sql`SELECT * FROM investors WHERE id = ${id}`;
  return rows[0] ? toInvestor(rows[0]) : undefined;
}

export async function createInvestor(input: Partial<InvestorRow>): Promise<InvestorRow> {
  await ensureSchema();
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
  await sql`
    INSERT INTO investors (
      id, name, relationship, phone, email, default_bank_account, default_bank_ifsc,
      demand_account_number, pan_masked, status, created_at, notes
    ) VALUES (
      ${investor.id}, ${investor.name}, ${investor.relationship}, ${investor.phone}, ${investor.email},
      ${investor.defaultBankAccount}, ${investor.defaultBankIfsc}, ${investor.demandAccountNumber},
      ${investor.panMasked}, ${investor.status}, ${investor.createdAt}, ${investor.notes}
    )
  `;
  return investor;
}

export async function updateInvestor(
  id: string,
  patch: Partial<InvestorRow>
): Promise<InvestorRow> {
  await ensureSchema();
  const existing = await getInvestor(id);
  if (!existing) throw new Error(`Investor ${id} not found`);
  const merged: InvestorRow = { ...existing, ...patch, id };
  await sql`
    UPDATE investors SET
      name = ${merged.name}, relationship = ${merged.relationship}, phone = ${merged.phone},
      email = ${merged.email}, default_bank_account = ${merged.defaultBankAccount},
      default_bank_ifsc = ${merged.defaultBankIfsc}, demand_account_number = ${merged.demandAccountNumber},
      pan_masked = ${merged.panMasked}, status = ${merged.status}, notes = ${merged.notes}
    WHERE id = ${id}
  `;
  return merged;
}

export async function deleteInvestor(id: string): Promise<void> {
  await ensureSchema();
  await sql`DELETE FROM investors WHERE id = ${id}`;
}
