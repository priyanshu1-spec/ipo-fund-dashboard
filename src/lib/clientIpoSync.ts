"use client";

// ============================================================================
// Client-side, best-effort IPO data fetcher — runs entirely in the browser
// when someone clicks "Sync Now" (there is no server-side sync anymore).
//
// IMPORTANT — read this before relying on it:
// A browser cannot fetch() an arbitrary external website directly (CORS
// blocks it), so this routes the request through a free public CORS proxy
// (api.allorigins.win). That proxy can be slow, rate-limited, or
// occasionally down — an extra point of failure beyond the target site
// itself possibly blocking automated visits or requiring JavaScript to
// render its data (which this plain-HTML parser can't run). This is
// meaningfully less reliable than a server-side fetch would be — it's what
// "purely client-side, no backend" costs here. Manual "Add IPO" and "Bulk
// Import JSON" always work regardless.
// ============================================================================

import type { IpoRow, IpoStatus, IpoType } from "@/types";

export interface ScrapedIpo {
  name: string;
  type: IpoType;
  openDate: string;
  closeDate: string;
  priceBandMin: number;
  priceBandMax: number;
  lotSize: number;
  issueSize: string;
  status: IpoStatus;
  gmp: number;
  sourceUrl: string;
}

export interface SyncSource {
  url: string;
  type: IpoType;
}

const CORS_PROXY = "https://api.allorigins.win/raw?url=";

/** Default sources, overridable via NEXT_PUBLIC_IPO_SYNC_SOURCES ("url|Mainboard,url|SME"). */
export function getDefaultSources(): SyncSource[] {
  const raw = process.env.NEXT_PUBLIC_IPO_SYNC_SOURCES ?? "";
  const fromEnv = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((entry) => {
      const [url, type] = entry.split("|");
      return { url: url.trim(), type: (type?.trim() === "SME" ? "SME" : "Mainboard") as IpoType };
    });
  if (fromEnv.length > 0) return fromEnv;
  return [{ url: "https://www.nseindia.com/market-data/all-upcoming-issues-ipo", type: "Mainboard" }];
}

const HEADER_KEYWORDS: Record<string, string[]> = {
  name: ["company", "ipo name", "issuer", "name"],
  openDate: ["open date", "bid open", "open"],
  closeDate: ["close date", "bid close", "close"],
  priceBand: ["price band", "issue price", "price"],
  lotSize: ["lot size", "min lot", "lot"],
  issueSize: ["issue size", "size (cr)", "size"],
  gmp: ["gmp", "grey market premium", "premium"],
};

function matchHeader(headerText: string): string | null {
  const h = headerText.trim().toLowerCase();
  for (const [field, keywords] of Object.entries(HEADER_KEYWORDS)) {
    if (keywords.some((k) => h.includes(k))) return field;
  }
  return null;
}

function parsePriceBand(text: string): { min: number; max: number } {
  const nums = (text.match(/[\d,]+(\.\d+)?/g) ?? []).map((n) => parseFloat(n.replace(/,/g, "")));
  if (nums.length === 0) return { min: 0, max: 0 };
  if (nums.length === 1) return { min: nums[0], max: nums[0] };
  return { min: Math.min(...nums), max: Math.max(...nums) };
}

function parseNumber(text: string): number {
  const match = text.replace(/,/g, "").match(/-?\d+(\.\d+)?/);
  return match ? parseFloat(match[0]) : 0;
}

function parseDate(text: string): string {
  const parsed = new Date(text.trim());
  return isNaN(parsed.getTime()) ? "" : parsed.toISOString().slice(0, 10);
}

/** Heuristic HTML table parser using the browser's native DOMParser — the client-side equivalent of the old server-side cheerio parser. */
function extractIposFromHtml(html: string, sourceUrl: string, type: IpoType): ScrapedIpo[] {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const results: ScrapedIpo[] = [];

  doc.querySelectorAll("table").forEach((table) => {
    const rows = Array.from(table.querySelectorAll("tr"));
    if (rows.length < 2) return;

    const headerCells = Array.from(rows[0].querySelectorAll("th, td"));
    const fieldMap = headerCells.map((cell) => matchHeader(cell.textContent ?? ""));
    const recognizedFields = fieldMap.filter(Boolean);
    if (!fieldMap.includes("name") || recognizedFields.length < 3) return;

    for (let r = 1; r < rows.length; r++) {
      const cells = Array.from(rows[r].querySelectorAll("td"));
      if (cells.length === 0) continue;
      const raw: Record<string, string> = {};
      cells.forEach((cell, i) => {
        const field = fieldMap[i];
        if (field) raw[field] = (cell.textContent ?? "").trim();
      });
      if (!raw.name) continue;

      const priceBand = parsePriceBand(raw.priceBand ?? "");
      results.push({
        name: raw.name,
        type,
        openDate: parseDate(raw.openDate ?? ""),
        closeDate: parseDate(raw.closeDate ?? ""),
        priceBandMin: priceBand.min,
        priceBandMax: priceBand.max,
        lotSize: parseNumber(raw.lotSize ?? ""),
        issueSize: raw.issueSize ?? "",
        status: "Upcoming",
        gmp: parseNumber(raw.gmp ?? ""),
        sourceUrl,
      });
    }
  });

  return results;
}

export async function syncIposClientSide(
  sources: SyncSource[]
): Promise<{ ipos: ScrapedIpo[]; errors: { url: string; message: string }[] }> {
  const ipos: ScrapedIpo[] = [];
  const errors: { url: string; message: string }[] = [];

  for (const source of sources) {
    try {
      const res = await fetch(CORS_PROXY + encodeURIComponent(source.url), {
        signal: AbortSignal.timeout(20_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} (via CORS proxy)`);
      const html = await res.text();
      ipos.push(...extractIposFromHtml(html, source.url, source.type));
    } catch (err) {
      errors.push({ url: source.url, message: err instanceof Error ? err.message : String(err) });
    }
  }

  return { ipos, errors };
}

/** Merges a freshly scraped/imported IPO into an existing IpoRow, preferring existing manual edits. */
export function mergeScrapedIntoExisting(scraped: ScrapedIpo, existing: IpoRow | undefined): IpoRow {
  const now = new Date().toISOString();
  if (!existing) {
    return {
      id: "", // caller assigns
      name: scraped.name,
      type: scraped.type,
      openDate: scraped.openDate,
      closeDate: scraped.closeDate,
      allotmentDate: "",
      refundDate: "",
      listingDate: "",
      priceBandMin: scraped.priceBandMin,
      priceBandMax: scraped.priceBandMax,
      lotSize: scraped.lotSize,
      issueSize: scraped.issueSize,
      status: scraped.status,
      gmp: scraped.gmp,
      gmpUpdatedAt: now,
      listingPrice: null,
      exchange: scraped.type === "SME" ? "NSE SME / BSE SME" : "NSE / BSE",
      sourceUrl: scraped.sourceUrl,
      lastSyncedAt: now,
      notes: "",
    };
  }
  return {
    ...existing,
    openDate: existing.openDate || scraped.openDate,
    closeDate: existing.closeDate || scraped.closeDate,
    priceBandMin: existing.priceBandMin || scraped.priceBandMin,
    priceBandMax: existing.priceBandMax || scraped.priceBandMax,
    lotSize: existing.lotSize || scraped.lotSize,
    issueSize: existing.issueSize || scraped.issueSize,
    gmp: scraped.gmp || existing.gmp,
    gmpUpdatedAt: now,
    lastSyncedAt: now,
  };
}

/** Bulk import fallback: parses a JSON array (from CSV-to-JSON paste, etc.) into ScrapedIpo[]. */
export function importIposFromJson(jsonText: string): ScrapedIpo[] {
  const parsed = JSON.parse(jsonText);
  if (!Array.isArray(parsed)) throw new Error("Expected a JSON array of IPO objects");
  return parsed.map((item) => ({
    name: String(item.name ?? ""),
    type: (item.type === "SME" ? "SME" : "Mainboard") as IpoType,
    openDate: String(item.openDate ?? ""),
    closeDate: String(item.closeDate ?? ""),
    priceBandMin: Number(item.priceBandMin ?? 0),
    priceBandMax: Number(item.priceBandMax ?? 0),
    lotSize: Number(item.lotSize ?? 0),
    issueSize: String(item.issueSize ?? ""),
    status: (item.status ?? "Upcoming") as IpoStatus,
    gmp: Number(item.gmp ?? 0),
    sourceUrl: String(item.sourceUrl ?? "manual-import"),
  }));
}
