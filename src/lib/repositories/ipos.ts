import { ensureSchema, sql } from "@/lib/db";
import { generateId, num } from "@/lib/id";
import type { IpoRow } from "@/types";

function toIpo(r: Record<string, unknown>): IpoRow {
  return {
    id: String(r.id ?? ""),
    name: String(r.name ?? ""),
    type: (r.type as IpoRow["type"]) || "Mainboard",
    openDate: String(r.open_date ?? ""),
    closeDate: String(r.close_date ?? ""),
    allotmentDate: String(r.allotment_date ?? ""),
    refundDate: String(r.refund_date ?? ""),
    listingDate: String(r.listing_date ?? ""),
    priceBandMin: num(r.price_band_min),
    priceBandMax: num(r.price_band_max),
    lotSize: num(r.lot_size),
    issueSize: String(r.issue_size ?? ""),
    status: (r.status as IpoRow["status"]) || "Upcoming",
    gmp: num(r.gmp),
    gmpUpdatedAt: String(r.gmp_updated_at ?? ""),
    listingPrice: r.listing_price == null ? null : num(r.listing_price),
    exchange: String(r.exchange ?? ""),
    sourceUrl: String(r.source_url ?? ""),
    lastSyncedAt: String(r.last_synced_at ?? ""),
    notes: String(r.notes ?? ""),
  };
}

export async function listIpos(): Promise<IpoRow[]> {
  await ensureSchema();
  const { rows } = await sql`SELECT * FROM ipos ORDER BY open_date DESC NULLS LAST`;
  return rows.map(toIpo);
}

export async function getIpo(id: string): Promise<IpoRow | undefined> {
  await ensureSchema();
  const { rows } = await sql`SELECT * FROM ipos WHERE id = ${id}`;
  return rows[0] ? toIpo(rows[0]) : undefined;
}

export async function findIpoByName(name: string): Promise<IpoRow | undefined> {
  await ensureSchema();
  const { rows } = await sql`SELECT * FROM ipos WHERE LOWER(name) = LOWER(${name.trim()}) LIMIT 1`;
  return rows[0] ? toIpo(rows[0]) : undefined;
}

export async function createIpo(input: Partial<IpoRow>): Promise<IpoRow> {
  await ensureSchema();
  const now = new Date().toISOString();
  const ipo: IpoRow = {
    id: generateId("ipo"),
    name: input.name ?? "",
    type: input.type ?? "Mainboard",
    openDate: input.openDate ?? "",
    closeDate: input.closeDate ?? "",
    allotmentDate: input.allotmentDate ?? "",
    refundDate: input.refundDate ?? "",
    listingDate: input.listingDate ?? "",
    priceBandMin: input.priceBandMin ?? 0,
    priceBandMax: input.priceBandMax ?? 0,
    lotSize: input.lotSize ?? 0,
    issueSize: input.issueSize ?? "",
    status: input.status ?? "Upcoming",
    gmp: input.gmp ?? 0,
    gmpUpdatedAt: input.gmpUpdatedAt ?? now,
    listingPrice: input.listingPrice ?? null,
    exchange: input.exchange ?? "",
    sourceUrl: input.sourceUrl ?? "",
    lastSyncedAt: input.lastSyncedAt ?? now,
    notes: input.notes ?? "",
  };
  await sql`
    INSERT INTO ipos (
      id, name, type, open_date, close_date, allotment_date, refund_date, listing_date,
      price_band_min, price_band_max, lot_size, issue_size, status, gmp, gmp_updated_at,
      listing_price, exchange, source_url, last_synced_at, notes
    ) VALUES (
      ${ipo.id}, ${ipo.name}, ${ipo.type}, ${ipo.openDate}, ${ipo.closeDate}, ${ipo.allotmentDate},
      ${ipo.refundDate}, ${ipo.listingDate}, ${ipo.priceBandMin}, ${ipo.priceBandMax}, ${ipo.lotSize},
      ${ipo.issueSize}, ${ipo.status}, ${ipo.gmp}, ${ipo.gmpUpdatedAt}, ${ipo.listingPrice},
      ${ipo.exchange}, ${ipo.sourceUrl}, ${ipo.lastSyncedAt}, ${ipo.notes}
    )
  `;
  return ipo;
}

export async function updateIpo(id: string, patch: Partial<IpoRow>): Promise<IpoRow> {
  await ensureSchema();
  const existing = await getIpo(id);
  if (!existing) throw new Error(`IPO ${id} not found`);
  const merged: IpoRow = { ...existing, ...patch, id };
  await sql`
    UPDATE ipos SET
      name = ${merged.name}, type = ${merged.type}, open_date = ${merged.openDate},
      close_date = ${merged.closeDate}, allotment_date = ${merged.allotmentDate},
      refund_date = ${merged.refundDate}, listing_date = ${merged.listingDate},
      price_band_min = ${merged.priceBandMin}, price_band_max = ${merged.priceBandMax},
      lot_size = ${merged.lotSize}, issue_size = ${merged.issueSize}, status = ${merged.status},
      gmp = ${merged.gmp}, gmp_updated_at = ${merged.gmpUpdatedAt},
      listing_price = ${merged.listingPrice}, exchange = ${merged.exchange},
      source_url = ${merged.sourceUrl}, last_synced_at = ${merged.lastSyncedAt}, notes = ${merged.notes}
    WHERE id = ${id}
  `;
  return merged;
}

export async function deleteIpo(id: string): Promise<void> {
  await ensureSchema();
  await sql`DELETE FROM ipos WHERE id = ${id}`;
}
