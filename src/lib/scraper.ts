// ============================================================================
// Best-effort automated IPO data fetcher.
//
// IMPORTANT — read this before relying on it:
// Public IPO portals (Chittorgarh, NSE, BSE, etc.) do not offer a free,
// stable public API, and their HTML changes without notice. Rather than
// hard-coding brittle CSS selectors that silently break, this scraper uses a
// *heuristic table parser*: it looks at every <table> on the target page,
// tries to recognize a header row by matching common column-name keywords
// (Company / IPO Name, Open, Close, Price Band, Lot Size, Issue Size...),
// and only extracts rows from tables where it's confident about the mapping.
//
// This is intentionally resilient over precise. It will sometimes extract
// nothing (safe — falls through to "no changes"), rarely extract junk (you
// review before it's saved), and needs occasional maintenance if you point
// it at a new source. For that reason:
//   1. Manual add/edit of IPOs in the UI always works, regardless of scraper health.
//   2. Bulk CSV/JSON import (importIposFromJson below) is a reliable fallback.
// ============================================================================

import * as cheerio from "cheerio";
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
  const cleaned = text.trim();
  const parsed = new Date(cleaned);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }
  return "";
}

/** Parses any HTML page and heuristically extracts IPO-like table rows. */
export function extractIposFromHtml(html: string, sourceUrl: string, type: IpoType): ScrapedIpo[] {
  const $ = cheerio.load(html);
  const results: ScrapedIpo[] = [];

  $("table").each((_, table) => {
    const $table = $(table);
    const headerCells = $table.find("thead tr, tr").first().find("th, td");
    const fieldMap: (string | null)[] = [];
    headerCells.each((i, cell) => {
      fieldMap[i] = matchHeader($(cell).text());
    });

    const recognizedFields = fieldMap.filter(Boolean);
    // Require at least "name" plus 2 other recognizable columns before trusting this table.
    if (!fieldMap.includes("name") || recognizedFields.length < 3) return;

    const bodyRows = $table.find("tbody tr").length ? $table.find("tbody tr") : $table.find("tr").slice(1);

    bodyRows.each((_, row) => {
      const cells = $(row).find("td");
      if (cells.length === 0) return;
      const raw: Record<string, string> = {};
      cells.each((i, cell) => {
        const field = fieldMap[i];
        if (field) raw[field] = $(cell).text().trim();
      });
      if (!raw.name) return;

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
    });
  });

  return results;
}

export interface SyncSource {
  url: string;
  type: IpoType;
}

/**
 * Attempts to fetch and parse each configured source. Never throws — a
 * failed source just contributes zero rows and an entry in `errors`, so one
 * broken source doesn't block the others.
 */
export async function syncIposFromSources(
  sources: SyncSource[]
): Promise<{ ipos: ScrapedIpo[]; errors: { url: string; message: string }[] }> {
  const ipos: ScrapedIpo[] = [];
  const errors: { url: string; message: string }[] = [];

  for (const source of sources) {
    try {
      const res = await fetch(source.url, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; IpoFundDashboard/1.0)" },
        // 15s timeout via AbortSignal so one slow source can't hang the whole sync.
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const html = await res.text();
      ipos.push(...extractIposFromHtml(html, source.url, source.type));
    } catch (err) {
      errors.push({ url: source.url, message: err instanceof Error ? err.message : String(err) });
    }
  }

  return { ipos, errors };
}

/** Merges a freshly scraped/imported IPO into an existing IpoRow, preferring existing manual edits. */
export function mergeScrapedIntoExisting(
  scraped: ScrapedIpo,
  existing: IpoRow | undefined
): Partial<IpoRow> {
  const now = new Date().toISOString();
  if (!existing) {
    return {
      name: scraped.name,
      type: scraped.type,
      openDate: scraped.openDate,
      closeDate: scraped.closeDate,
      priceBandMin: scraped.priceBandMin,
      priceBandMax: scraped.priceBandMax,
      lotSize: scraped.lotSize,
      issueSize: scraped.issueSize,
      status: scraped.status,
      gmp: scraped.gmp,
      gmpUpdatedAt: now,
      exchange: scraped.type === "SME" ? "NSE SME / BSE SME" : "NSE / BSE",
      sourceUrl: scraped.sourceUrl,
      lastSyncedAt: now,
    };
  }
  // Never clobber dates/price-band the user already entered manually with blanks;
  // do refresh GMP every sync since that's meant to move daily.
  return {
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
