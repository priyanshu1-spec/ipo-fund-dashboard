import { ensureSchema, sql } from "@/lib/db";
import { generateId, num } from "@/lib/id";
import type { ApplicationRow } from "@/types";

function toApplication(r: Record<string, unknown>): ApplicationRow {
  return {
    id: String(r.id ?? ""),
    ipoId: String(r.ipo_id ?? ""),
    ipoName: String(r.ipo_name ?? ""),
    appliedInNameOf: String(r.applied_in_name_of ?? ""),
    investorId: String(r.investor_id ?? ""),
    panMasked: String(r.pan_masked ?? ""),
    applicationNumber: String(r.application_number ?? ""),
    upiId: String(r.upi_id ?? ""),
    category: (r.category as ApplicationRow["category"]) || "Retail",
    lotsApplied: num(r.lots_applied),
    amountBlocked: num(r.amount_blocked),
    paymentMode: (r.payment_mode as ApplicationRow["paymentMode"]) || "UPI",
    allotmentStatus: (r.allotment_status as ApplicationRow["allotmentStatus"]) || "Pending",
    lotsAllotted: num(r.lots_allotted),
    amountAllotted: num(r.amount_allotted),
    refundAmount: num(r.refund_amount),
    refundStatus: (r.refund_status as ApplicationRow["refundStatus"]) || "N/A",
    refundDate: String(r.refund_date ?? ""),
    sellDate: String(r.sell_date ?? ""),
    sellPrice: num(r.sell_price),
    createdBy: String(r.created_by ?? ""),
    createdAt: String(r.created_at ?? ""),
    updatedAt: String(r.updated_at ?? ""),
    notes: String(r.notes ?? ""),
  };
}

/** ownerId: string | null — null means admin (unscoped, sees every row). See investors.ts for the full rationale. */
export async function listApplications(ownerId: string | null): Promise<ApplicationRow[]> {
  await ensureSchema();
  const { rows } =
    ownerId == null
      ? await sql`SELECT * FROM applications ORDER BY created_at DESC NULLS LAST`
      : await sql`SELECT * FROM applications WHERE owner_id = ${ownerId} ORDER BY created_at DESC NULLS LAST`;
  return rows.map(toApplication);
}

export async function getApplication(id: string, ownerId: string | null): Promise<ApplicationRow | undefined> {
  await ensureSchema();
  const { rows } =
    ownerId == null
      ? await sql`SELECT * FROM applications WHERE id = ${id}`
      : await sql`SELECT * FROM applications WHERE id = ${id} AND owner_id = ${ownerId}`;
  return rows[0] ? toApplication(rows[0]) : undefined;
}

export async function createApplication(
  input: Partial<ApplicationRow>,
  createdBy: string,
  ownerId: string
): Promise<ApplicationRow> {
  await ensureSchema();
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
  await sql`
    INSERT INTO applications (
      id, owner_id, ipo_id, ipo_name, applied_in_name_of, investor_id, pan_masked, application_number,
      upi_id, category, lots_applied, amount_blocked, payment_mode, allotment_status,
      lots_allotted, amount_allotted, refund_amount, refund_status, refund_date, sell_date,
      sell_price, created_by, created_at, updated_at, notes
    ) VALUES (
      ${app.id}, ${ownerId}, ${app.ipoId}, ${app.ipoName}, ${app.appliedInNameOf}, ${app.investorId},
      ${app.panMasked}, ${app.applicationNumber}, ${app.upiId}, ${app.category}, ${app.lotsApplied},
      ${app.amountBlocked}, ${app.paymentMode}, ${app.allotmentStatus}, ${app.lotsAllotted},
      ${app.amountAllotted}, ${app.refundAmount}, ${app.refundStatus}, ${app.refundDate},
      ${app.sellDate}, ${app.sellPrice}, ${app.createdBy}, ${app.createdAt}, ${app.updatedAt}, ${app.notes}
    )
  `;
  return app;
}

export async function updateApplication(
  id: string,
  patch: Partial<ApplicationRow>,
  ownerId: string | null
): Promise<ApplicationRow> {
  await ensureSchema();
  const existing = await getApplication(id, ownerId);
  if (!existing) throw new Error(`Application ${id} not found`);
  const merged: ApplicationRow = { ...existing, ...patch, id, updatedAt: new Date().toISOString() };
  await sql`
    UPDATE applications SET
      ipo_id = ${merged.ipoId}, ipo_name = ${merged.ipoName},
      applied_in_name_of = ${merged.appliedInNameOf}, investor_id = ${merged.investorId},
      pan_masked = ${merged.panMasked}, application_number = ${merged.applicationNumber},
      upi_id = ${merged.upiId}, category = ${merged.category}, lots_applied = ${merged.lotsApplied},
      amount_blocked = ${merged.amountBlocked}, payment_mode = ${merged.paymentMode},
      allotment_status = ${merged.allotmentStatus}, lots_allotted = ${merged.lotsAllotted},
      amount_allotted = ${merged.amountAllotted}, refund_amount = ${merged.refundAmount},
      refund_status = ${merged.refundStatus}, refund_date = ${merged.refundDate},
      sell_date = ${merged.sellDate}, sell_price = ${merged.sellPrice}, updated_at = ${merged.updatedAt},
      notes = ${merged.notes}
    WHERE id = ${id}
  `;
  return merged;
}

export async function deleteApplication(id: string, ownerId: string | null): Promise<void> {
  await ensureSchema();
  if (ownerId == null) {
    await sql`DELETE FROM applications WHERE id = ${id}`;
  } else {
    await sql`DELETE FROM applications WHERE id = ${id} AND owner_id = ${ownerId}`;
  }
}
