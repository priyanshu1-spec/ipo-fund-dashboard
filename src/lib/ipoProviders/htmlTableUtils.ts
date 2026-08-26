// ============================================================================
// Shared helpers for HTML-table-scraping providers (chittorgarhProvider.ts,
// ipowatchProvider.ts, and any future one). Extracted once two providers
// needed the identical logic — a generic, header-text-driven table parser
// (matches columns by known label aliases rather than brittle CSS
// selectors/classes, which is what actually tolerates markup drift) plus a
// link-discovery fallback for when a guessed report-page URL is wrong.
// ============================================================================

import * as cheerio from "cheerio";

export const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept-Language": "en-US,en;q=0.9",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
};

export function normalizeHeader(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

export function normalizeCompanyName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(limited|ltd|india|pvt|private|inc)\b\.?/g, "")
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

export function parseDate(text: string): string | undefined {
  const cleaned = text.trim();
  if (!cleaned || cleaned === "-" || /^n\.?a\.?$/i.test(cleaned)) return undefined;
  const direct = new Date(cleaned);
  if (!isNaN(direct.getTime())) return direct.toISOString().slice(0, 10);
  // "28-Aug-2026" / "28 Aug 2026" style, which Date() parses inconsistently across engines.
  const match = cleaned.match(/(\d{1,2})[-\s](\w{3,9})[-\s](\d{4})/);
  if (match) {
    const retry = new Date(`${match[2]} ${match[1]}, ${match[3]}`);
    if (!isNaN(retry.getTime())) return retry.toISOString().slice(0, 10);
  }
  return undefined;
}

export function parseNum(text: string): number | undefined {
  const match = text.replace(/,/g, "").match(/-?\d+(\.\d+)?/);
  return match ? parseFloat(match[0]) : undefined;
}

export function parsePriceBand(text: string): { min?: number; max?: number } {
  const nums = (text.match(/[\d,]+(\.\d+)?/g) ?? []).map((n) => parseFloat(n.replace(/,/g, "")));
  if (nums.length === 0) return {};
  if (nums.length === 1) return { min: nums[0], max: nums[0] };
  return { min: Math.min(...nums), max: Math.max(...nums) };
}

export interface TableRowData {
  [column: string]: string;
}

export interface ExtractResult {
  tables: TableRowData[][];
  /**
   * Populated only when zero tables matched, specifically so a failure is
   * diagnosable from the fetch-log warning alone (Settings page) without
   * needing live access to the source site — this sandbox's network policy
   * can't reach any of these. Each entry is one <table>'s raw header cell
   * text, in DOM order, so a real column layout can be read directly off
   * the next failure instead of guessed at again.
   */
  diagnostics?: string[];
}

/** Scans every <table> on the page; for each one whose header row has a recognizable "name" column (per columnAliases), yields its body rows as {columnKey: cellText} maps. Tables without a name column (nav, unrelated widgets) are silently skipped — not every table on a page is the data table. */
export function extractTables($: cheerio.CheerioAPI, columnAliases: Record<string, string[]>): ExtractResult {
  const tables: TableRowData[][] = [];
  const allHeaderSets: string[] = [];

  $("table").each((_, table) => {
    const $table = $(table);
    const rawHeaderCells = $table
      .find("tr")
      .first()
      .find("th, td")
      .map((__, cell) => $(cell).text().trim())
      .get();
    if (rawHeaderCells.length === 0) return;
    allHeaderSets.push(rawHeaderCells.join(" | "));

    const headerCells = rawHeaderCells.map(normalizeHeader);
    const columnKeyByIndex: (string | undefined)[] = headerCells.map((header) => {
      for (const [key, aliases] of Object.entries(columnAliases)) {
        if (aliases.some((alias) => header.includes(alias))) return key;
      }
      return undefined;
    });
    if (!columnKeyByIndex.includes("name")) return;

    const rows: TableRowData[] = [];
    $table
      .find("tr")
      .slice(1)
      .each((__, tr) => {
        const cells = $(tr)
          .find("td")
          .map((___, cell) => $(cell).text().trim())
          .get();
        if (cells.length === 0) return;
        const row: TableRowData = {};
        cells.forEach((text, i) => {
          const key = columnKeyByIndex[i];
          if (key) row[key] = text;
        });
        if (row.name) rows.push(row);
      });
    if (rows.length > 0) tables.push(rows);
  });

  if (tables.length > 0) return { tables };
  return {
    tables,
    diagnostics:
      allHeaderSets.length > 0
        ? allHeaderSets.slice(0, 5)
        : ["No <table> elements found on the page at all — content may be JavaScript-rendered."],
  };
}

export type PageResult = { ok: true; $: cheerio.CheerioAPI } | { ok: false; warning: string };

export async function fetchPage(url: string): Promise<PageResult> {
  try {
    const res = await fetch(url, { headers: BROWSER_HEADERS, signal: AbortSignal.timeout(15_000) });
    if (!res.ok) return { ok: false, warning: `HTTP ${res.status} fetching ${url}` };
    const html = await res.text();
    return { ok: true, $: cheerio.load(html) };
  } catch (err) {
    return { ok: false, warning: `Failed to fetch ${url}: ${err instanceof Error ? err.message : String(err)}` };
  }
}

/**
 * Scans <a> tags for hrefs whose URL or link text contains any of
 * `keywords` — used as a fallback when a guessed report-page URL 404s or
 * has no usable table, so the failure warning suggests real candidate URLs
 * instead of just saying "wrong guess" with no way to fix it without
 * another round trip.
 */
export function findCandidateLinks($: cheerio.CheerioAPI, baseUrl: string, keywords: string[]): string[] {
  const found = new Set<string>();
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href") ?? "";
    const text = $(el).text().toLowerCase();
    const lowerHref = href.toLowerCase();
    if (!keywords.some((k) => lowerHref.includes(k) || text.includes(k))) return;
    try {
      found.add(new URL(href, baseUrl).toString());
    } catch {
      // Malformed href — skip rather than throw.
    }
  });
  return Array.from(found).slice(0, 15);
}
