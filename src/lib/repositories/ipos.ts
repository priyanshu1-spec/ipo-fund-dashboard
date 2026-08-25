import { appendRow, deleteRow, readAllRows, updateRow } from "@/lib/googleSheets";
import { IPO_HEADERS, TABS } from "@/lib/sheetSchemas";
import { generateId, num } from "@/lib/id";
import type { IpoRow } from "@/types";

function toIpo(r: Record<string, unknown>): IpoRow {
  return {
    id: String(r.id ?? ""),
    name: String(r.name ?? ""),
    type: (r.type as IpoRow["type"]) || "Mainboard",
    openDate: String(r.openDate ?? ""),
    closeDate: String(r.closeDate ?? ""),
    allotmentDate: String(r.allotmentDate ?? ""),
    refundDate: String(r.refundDate ?? ""),
    listingDate: String(r.listingDate ?? ""),
    priceBandMin: num(r.priceBandMin),
    priceBandMax: num(r.priceBandMax),
    lotSize: num(r.lotSize),
    issueSize: String(r.issueSize ?? ""),
    status: (r.status as IpoRow["status"]) || "Upcoming",
    gmp: num(r.gmp),
    gmpUpdatedAt: String(r.gmpUpdatedAt ?? ""),
    listingPrice: r.listingPrice === "" || r.listingPrice == null ? null : num(r.listingPrice),
    exchange: String(r.exchange ?? ""),
    sourceUrl: String(r.sourceUrl ?? ""),
    lastSyncedAt: String(r.lastSyncedAt ?? ""),
    notes: String(r.notes ?? ""),
  };
}

export async function listIpos(): Promise<IpoRow[]> {
  const rows = await readAllRows(TABS.IPO_MASTER, IPO_HEADERS);
  return rows.map(toIpo).sort((a, b) => (a.openDate < b.openDate ? 1 : -1));
}

export async function getIpo(id: string): Promise<IpoRow | undefined> {
  const rows = await listIpos();
  return rows.find((r) => r.id === id);
}

export async function findIpoByName(name: string): Promise<IpoRow | undefined> {
  const rows = await listIpos();
  return rows.find((r) => r.name.trim().toLowerCase() === name.trim().toLowerCase());
}

export async function createIpo(input: Partial<IpoRow>): Promise<IpoRow> {
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
    gmpUpdatedAt: input.gmpUpdatedAt ?? new Date().toISOString(),
    listingPrice: input.listingPrice ?? null,
    exchange: input.exchange ?? "",
    sourceUrl: input.sourceUrl ?? "",
    lastSyncedAt: input.lastSyncedAt ?? new Date().toISOString(),
    notes: input.notes ?? "",
  };
  await appendRow(TABS.IPO_MASTER, IPO_HEADERS, ipo);
  return ipo;
}

export async function updateIpo(id: string, patch: Partial<IpoRow>): Promise<IpoRow> {
  const rows = await readAllRows(TABS.IPO_MASTER, IPO_HEADERS);
  const existing = rows.find((r) => r.id === id);
  if (!existing) throw new Error(`IPO ${id} not found`);
  const merged = { ...toIpo(existing), ...patch, id };
  await updateRow(TABS.IPO_MASTER, IPO_HEADERS, existing._rowNumber, merged);
  return merged;
}

export async function deleteIpo(id: string): Promise<void> {
  const rows = await readAllRows(TABS.IPO_MASTER, IPO_HEADERS);
  const existing = rows.find((r) => r.id === id);
  if (!existing) return;
  await deleteRow(TABS.IPO_MASTER, existing._rowNumber);
}
