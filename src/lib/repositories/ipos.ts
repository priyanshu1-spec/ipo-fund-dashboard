import { ensureSchema, query, sql } from "@/lib/db";
import { generateId, num } from "@/lib/id";
import type { GmpHistoryEntry, IpoRow, IpoType, SubscriptionHistoryEntry } from "@/types";

/**
 * Stable IPO identifier: slug(name) + type. This guarantees the same
 * company+board always resolves to the same row across repeated fetches
 * from any provider, so "upsert by id" naturally prevents duplicates
 * without a separate lookup step.
 *
 * Limitation (documented, not hidden): before a symbol/ISIN is assigned,
 * name is the only thing every source agrees on, so a company that changes
 * its registered IPO name between filing and listing could produce two
 * rows. If that happens, use the admin edit screen to fix it manually —
 * this is a known trade-off of not having a universal pre-listing ID.
 */
export function generateIpoId(name: string, type: IpoType): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `ipo_${slug}_${type.toLowerCase()}`;
}

function toIpo(r: Record<string, unknown>): IpoRow {
  return {
    id: String(r.id ?? ""),
    name: String(r.name ?? ""),
    symbol: String(r.symbol ?? ""),
    type: (r.type as IpoRow["type"]) || "Mainboard",
    issueType: String(r.issue_type ?? ""),
    openDate: String(r.open_date ?? ""),
    closeDate: String(r.close_date ?? ""),
    allotmentDate: String(r.allotment_date ?? ""),
    refundDate: String(r.refund_date ?? ""),
    listingDate: String(r.listing_date ?? ""),
    priceBandMin: num(r.price_band_min),
    priceBandMax: num(r.price_band_max),
    faceValue: r.face_value == null ? null : num(r.face_value),
    lotSize: r.lot_size == null ? null : num(r.lot_size),
    minInvestment: r.min_investment == null ? null : num(r.min_investment),
    issueSize: String(r.issue_size ?? ""),
    freshIssueSize: String(r.fresh_issue_size ?? ""),
    offerForSaleSize: String(r.offer_for_sale_size ?? ""),
    status: (r.status as IpoRow["status"]) || "Upcoming",
    registrar: String(r.registrar ?? ""),
    leadManagers: String(r.lead_managers ?? ""),
    qibSubscription: r.qib_subscription == null ? null : num(r.qib_subscription),
    niiSubscription: r.nii_subscription == null ? null : num(r.nii_subscription),
    retailSubscription: r.retail_subscription == null ? null : num(r.retail_subscription),
    employeeSubscription: r.employee_subscription == null ? null : num(r.employee_subscription),
    shareholderSubscription: r.shareholder_subscription == null ? null : num(r.shareholder_subscription),
    overallSubscription: r.overall_subscription == null ? null : num(r.overall_subscription),
    gmp: r.gmp == null ? null : num(r.gmp),
    gmpUpdatedAt: String(r.gmp_updated_at ?? ""),
    listingPrice: r.listing_price == null ? null : num(r.listing_price),
    listingGainPercent: r.listing_gain_percent == null ? null : num(r.listing_gain_percent),
    exchange: String(r.exchange ?? ""),
    isOfficial: Boolean(r.is_official),
    dataSource: (r.data_source as IpoRow["dataSource"]) || "Manual",
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

/** Lightweight id+name listing for a type — used to fuzzy-match a secondary provider's spelling of a company name against the row an earlier provider already created, without pulling every column. */
export async function listIpoIdsAndNames(type: IpoType): Promise<{ id: string; name: string }[]> {
  await ensureSchema();
  const { rows } = await sql`SELECT id, name FROM ipos WHERE type = ${type}`;
  return rows.map((r) => ({ id: String(r.id), name: String(r.name) }));
}

const IPO_COLUMNS = [
  "id", "name", "symbol", "type", "issue_type", "open_date", "close_date", "allotment_date",
  "refund_date", "listing_date", "price_band_min", "price_band_max", "face_value", "lot_size",
  "min_investment", "issue_size", "fresh_issue_size", "offer_for_sale_size", "status", "registrar",
  "lead_managers", "qib_subscription", "nii_subscription", "retail_subscription",
  "employee_subscription", "shareholder_subscription", "overall_subscription", "gmp",
  "gmp_updated_at", "listing_price", "listing_gain_percent", "exchange", "is_official",
  "data_source", "source_url", "last_synced_at", "notes",
] as const;

function toColumnValues(ipo: IpoRow): unknown[] {
  return [
    ipo.id, ipo.name, ipo.symbol, ipo.type, ipo.issueType, ipo.openDate, ipo.closeDate,
    ipo.allotmentDate, ipo.refundDate, ipo.listingDate, ipo.priceBandMin, ipo.priceBandMax,
    ipo.faceValue, ipo.lotSize, ipo.minInvestment, ipo.issueSize, ipo.freshIssueSize,
    ipo.offerForSaleSize, ipo.status, ipo.registrar, ipo.leadManagers, ipo.qibSubscription,
    ipo.niiSubscription, ipo.retailSubscription, ipo.employeeSubscription,
    ipo.shareholderSubscription, ipo.overallSubscription, ipo.gmp, ipo.gmpUpdatedAt,
    ipo.listingPrice, ipo.listingGainPercent, ipo.exchange, ipo.isOfficial, ipo.dataSource,
    ipo.sourceUrl, ipo.lastSyncedAt, ipo.notes,
  ];
}

function defaultIpo(input: Partial<IpoRow>): IpoRow {
  const now = new Date().toISOString();
  const name = input.name ?? "";
  const type = input.type ?? "Mainboard";
  return {
    id: input.id ?? generateIpoId(name, type),
    name,
    symbol: input.symbol ?? "",
    type,
    issueType: input.issueType ?? "",
    openDate: input.openDate ?? "",
    closeDate: input.closeDate ?? "",
    allotmentDate: input.allotmentDate ?? "",
    refundDate: input.refundDate ?? "",
    listingDate: input.listingDate ?? "",
    priceBandMin: input.priceBandMin ?? 0,
    priceBandMax: input.priceBandMax ?? 0,
    faceValue: input.faceValue ?? null,
    lotSize: input.lotSize ?? null,
    minInvestment: input.minInvestment ?? null,
    issueSize: input.issueSize ?? "",
    freshIssueSize: input.freshIssueSize ?? "",
    offerForSaleSize: input.offerForSaleSize ?? "",
    status: input.status ?? "Upcoming",
    registrar: input.registrar ?? "",
    leadManagers: input.leadManagers ?? "",
    qibSubscription: input.qibSubscription ?? null,
    niiSubscription: input.niiSubscription ?? null,
    retailSubscription: input.retailSubscription ?? null,
    employeeSubscription: input.employeeSubscription ?? null,
    shareholderSubscription: input.shareholderSubscription ?? null,
    overallSubscription: input.overallSubscription ?? null,
    gmp: input.gmp ?? null,
    gmpUpdatedAt: input.gmpUpdatedAt ?? now,
    listingPrice: input.listingPrice ?? null,
    listingGainPercent: input.listingGainPercent ?? null,
    exchange: input.exchange ?? "",
    isOfficial: input.isOfficial ?? false,
    dataSource: input.dataSource ?? "Manual",
    sourceUrl: input.sourceUrl ?? "",
    lastSyncedAt: input.lastSyncedAt ?? now,
    notes: input.notes ?? "",
  };
}

export async function createIpo(input: Partial<IpoRow>): Promise<IpoRow> {
  await ensureSchema();
  const ipo = defaultIpo(input);
  const cols = IPO_COLUMNS.join(", ");
  const placeholders = IPO_COLUMNS.map((_, i) => `$${i + 1}`).join(", ");
  await query(`INSERT INTO ipos (${cols}) VALUES (${placeholders})`, toColumnValues(ipo));
  return ipo;
}

/** `knownExisting`: pass the row if the caller already fetched it (e.g. ipoSync.ts's resolveIpo) to skip a redundant SELECT — db.ts opens a fresh Postgres connection per query, so an avoidable one is real latency, not just noise, especially across dozens of rows in one sync. Omit it and this fetches the row itself, as before. */
export async function updateIpo(id: string, patch: Partial<IpoRow>, knownExisting?: IpoRow): Promise<IpoRow> {
  await ensureSchema();
  const existing = knownExisting ?? (await getIpo(id));
  if (!existing) throw new Error(`IPO ${id} not found`);
  const merged: IpoRow = { ...existing, ...patch, id };
  const columnsExceptId = IPO_COLUMNS.filter((c) => c !== "id");
  const setClauses = columnsExceptId.map((c, i) => `${c} = $${i + 2}`).join(", ");
  const allValues = toColumnValues(merged);
  const idIndex = IPO_COLUMNS.indexOf("id");
  const valuesExceptId = allValues.filter((_, i) => i !== idIndex);
  await query(`UPDATE ipos SET ${setClauses} WHERE id = $1`, [id, ...valuesExceptId]);
  return merged;
}

export async function deleteIpo(id: string): Promise<void> {
  await ensureSchema();
  await sql`DELETE FROM ipos WHERE id = ${id}`;
}

// ---- History -----------------------------------------------------------

export async function appendGmpHistory(ipoId: string, gmp: number, source: string): Promise<void> {
  await ensureSchema();
  const entry: GmpHistoryEntry = {
    id: generateId("gmph"),
    ipoId,
    gmp,
    recordedAt: new Date().toISOString(),
    source,
  };
  await sql`
    INSERT INTO ipo_gmp_history (id, ipo_id, gmp, recorded_at, source)
    VALUES (${entry.id}, ${entry.ipoId}, ${entry.gmp}, ${entry.recordedAt}, ${entry.source})
  `;
}

export async function listGmpHistory(ipoId: string): Promise<GmpHistoryEntry[]> {
  await ensureSchema();
  const { rows } = await sql`
    SELECT * FROM ipo_gmp_history WHERE ipo_id = ${ipoId} ORDER BY recorded_at ASC
  `;
  return rows.map((r) => ({
    id: String(r.id),
    ipoId: String(r.ipo_id),
    gmp: num(r.gmp),
    recordedAt: String(r.recorded_at),
    source: String(r.source ?? ""),
  }));
}

export async function appendSubscriptionHistory(
  ipoId: string,
  snapshot: {
    qib: number | null;
    nii: number | null;
    retail: number | null;
    employee: number | null;
    shareholder: number | null;
    overall: number | null;
  },
  source: string
): Promise<void> {
  await ensureSchema();
  const id = generateId("subh");
  const recordedAt = new Date().toISOString();
  await sql`
    INSERT INTO ipo_subscription_history (id, ipo_id, qib, nii, retail, employee, shareholder, overall, recorded_at, source)
    VALUES (${id}, ${ipoId}, ${snapshot.qib}, ${snapshot.nii}, ${snapshot.retail}, ${snapshot.employee}, ${snapshot.shareholder}, ${snapshot.overall}, ${recordedAt}, ${source})
  `;
}

export async function listSubscriptionHistory(ipoId: string): Promise<SubscriptionHistoryEntry[]> {
  await ensureSchema();
  const { rows } = await sql`
    SELECT * FROM ipo_subscription_history WHERE ipo_id = ${ipoId} ORDER BY recorded_at ASC
  `;
  return rows.map((r) => ({
    id: String(r.id),
    ipoId: String(r.ipo_id),
    qib: r.qib == null ? null : num(r.qib),
    nii: r.nii == null ? null : num(r.nii),
    retail: r.retail == null ? null : num(r.retail),
    employee: r.employee == null ? null : num(r.employee),
    shareholder: r.shareholder == null ? null : num(r.shareholder),
    overall: r.overall == null ? null : num(r.overall),
    recordedAt: String(r.recorded_at),
    source: String(r.source ?? ""),
  }));
}
