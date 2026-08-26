// ============================================================================
// Chittorgarh provider — a secondary, explicitly NON-official source
// (isOfficial: false) that fills in what NSE's endpoint usually doesn't
// publish before/around an issue opening: lot size, allotment/listing
// dates, and (like every GMP source, always) grey market premium. Reached
// via plain public report pages — no login, CAPTCHA, or Cloudflare bypass
// involved; if that ever changes, this provider is meant to fail closed
// (return zero rows + a warning), same contract as nseProvider.
//
// IMPORTANT CAVEAT (read before debugging a zero-rows warning): this file
// was written from general knowledge of chittorgarh.com's report-page
// layout, not from a live fetch — this sandbox's network policy blocks
// chittorgarh.com, so the exact table markup could not be verified before
// shipping. Parsing is deliberately header-text-driven (matches column
// headers by known aliases, not brittle CSS class names) specifically to
// tolerate that uncertainty. If chittorgarh.com has changed its markup, the
// realistic failure mode is "0 rows, 1 warning", not wrong/fabricated data
// — check the fetch-log warning first (Settings page) if this comes back
// empty after a real deploy, then adjust REPORT_URLS/column aliases below
// against the actual page.
//
// Never merges its own company-name spelling over an existing row's name —
// see resolveIpoId()/applyNormalizedIpo() in ipoSync.ts, which fuzzy-matches
// this provider's rows onto whatever NSE already created and keeps NSE's
// spelling. GMP from here is still always unofficial, same as any source.
// ============================================================================

import * as cheerio from "cheerio";
import type { IpoDataProvider, NormalizedIpo, ProviderFetchResult } from "./types";
import type { IpoType } from "@/types";

const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept-Language": "en-US,en;q=0.9",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
};

const REPORT_URLS = {
  mainboard: "https://www.chittorgarh.com/report/mainboard-ipo-list-in-india-bse-nse/83/",
  sme: "https://www.chittorgarh.com/report/sme-ipo-list-in-india-bse-sme-nse-emerge/22/",
  gmp: "https://www.chittorgarh.com/report/latest-ipo-gmp-grey-market-premium/23/",
};

// Column-header aliases, matched against a lowercased/punctuation-stripped
// version of each <th>/<td> in a table's header row. Deliberately loose
// (substring match) so small wording drift ("Open" vs "Open Date") still
// resolves, without guessing at a value no header actually names.
const COLUMN_ALIASES: Record<string, string[]> = {
  name: ["iponame", "companyname", "nameofissue", "issuername", "ipo"],
  open: ["open"],
  close: ["close"],
  allotment: ["boa", "basisofallotment", "allotmentdate", "allotment"],
  listing: ["listingdate", "listing"],
  lotSize: ["lotsize", "marketlot", "minlot"],
  price: ["issueprice", "priceband", "pricerange", "price"],
  issueSize: ["issuesize", "iposize"],
  gmp: ["gmp", "greymarketpremium"],
};

function normalizeHeader(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function normalizeCompanyName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(limited|ltd|india|pvt|private|inc)\b\.?/g, "")
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

function parseDate(text: string): string | undefined {
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

function parseNum(text: string): number | undefined {
  const match = text.replace(/,/g, "").match(/-?\d+(\.\d+)?/);
  return match ? parseFloat(match[0]) : undefined;
}

function parsePriceBand(text: string): { min?: number; max?: number } {
  const nums = (text.match(/[\d,]+(\.\d+)?/g) ?? []).map((n) => parseFloat(n.replace(/,/g, "")));
  if (nums.length === 0) return {};
  if (nums.length === 1) return { min: nums[0], max: nums[0] };
  return { min: Math.min(...nums), max: Math.max(...nums) };
}

interface TableRowData {
  [column: string]: string;
}

/** Scans every <table> on the page; for each one whose header row has a recognizable "name" column, yields its body rows as {columnKey: cellText} maps. Tables without a name column (nav, unrelated widgets) are silently skipped — not every table on a report page is the data table. */
function extractTables($: cheerio.CheerioAPI): TableRowData[][] {
  const tables: TableRowData[][] = [];

  $("table").each((_, table) => {
    const $table = $(table);
    const headerCells = $table
      .find("tr")
      .first()
      .find("th, td")
      .map((__, cell) => normalizeHeader($(cell).text()))
      .get();
    if (headerCells.length === 0) return;

    const columnKeyByIndex: (string | undefined)[] = headerCells.map((header) => {
      for (const [key, aliases] of Object.entries(COLUMN_ALIASES)) {
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

  return tables;
}

type PageResult = { ok: true; $: cheerio.CheerioAPI } | { ok: false; warning: string };

async function fetchPage(url: string): Promise<PageResult> {
  try {
    const res = await fetch(url, { headers: BROWSER_HEADERS, signal: AbortSignal.timeout(15_000) });
    if (!res.ok) return { ok: false, warning: `HTTP ${res.status} fetching ${url}` };
    const html = await res.text();
    return { ok: true, $: cheerio.load(html) };
  } catch (err) {
    return { ok: false, warning: `Failed to fetch ${url}: ${err instanceof Error ? err.message : String(err)}` };
  }
}

function rowsToNormalized(rows: TableRowData[], type: IpoType, sourceUrl: string): NormalizedIpo[] {
  const out: NormalizedIpo[] = [];
  for (const row of rows) {
    if (!row.name || row.name.trim().length < 2) continue;
    const priceBand = row.price ? parsePriceBand(row.price) : {};
    out.push({
      name: row.name.trim(),
      type,
      openDate: row.open ? parseDate(row.open) : undefined,
      closeDate: row.close ? parseDate(row.close) : undefined,
      allotmentDate: row.allotment ? parseDate(row.allotment) : undefined,
      listingDate: row.listing ? parseDate(row.listing) : undefined,
      priceBandMin: priceBand.min,
      priceBandMax: priceBand.max,
      lotSize: row.lotSize ? parseNum(row.lotSize) : undefined,
      issueSize: row.issueSize || undefined,
      gmp: row.gmp ? parseNum(row.gmp) : undefined,
      // No exchange guess here: chittorgarh's lists mix BSE- and NSE-listed
      // issues, and the table doesn't reliably expose which per row —
      // fabricating "NSE"/"NSE SME" would sometimes just be wrong.
      sourceUrl,
    });
  }
  return out;
}

export const chittorgarhProvider: IpoDataProvider = {
  key: "chittorgarh",
  displayName: "Chittorgarh",
  isOfficial: false,

  async fetch(): Promise<ProviderFetchResult> {
    const warnings: string[] = [];
    const ipos: NormalizedIpo[] = [];

    const [mainboardPage, smePage, gmpPage] = await Promise.all([
      fetchPage(REPORT_URLS.mainboard),
      fetchPage(REPORT_URLS.sme),
      fetchPage(REPORT_URLS.gmp),
    ]);

    const knownTypeByNormalizedName = new Map<string, IpoType>();

    for (const [page, type, url] of [
      [mainboardPage, "Mainboard", REPORT_URLS.mainboard],
      [smePage, "SME", REPORT_URLS.sme],
    ] as const) {
      if (!page.ok) {
        warnings.push(page.warning);
        continue;
      }
      const tables = extractTables(page.$);
      if (tables.length === 0) {
        warnings.push(`No recognizable data table found on ${url} — chittorgarh.com's markup may have changed.`);
        continue;
      }
      for (const rows of tables) {
        const normalized = rowsToNormalized(rows, type, url);
        for (const item of normalized) {
          knownTypeByNormalizedName.set(normalizeCompanyName(item.name), item.type);
        }
        ipos.push(...normalized);
      }
    }

    if (!gmpPage.ok) {
      warnings.push(gmpPage.warning);
    } else {
      const tables = extractTables(gmpPage.$);
      if (tables.length === 0) {
        warnings.push(`No recognizable data table found on ${REPORT_URLS.gmp} — chittorgarh.com's markup may have changed.`);
      }
      for (const rows of tables) {
        for (const row of rows) {
          if (!row.name || !row.gmp) continue;
          const type = knownTypeByNormalizedName.get(normalizeCompanyName(row.name));
          if (!type) continue; // Can't confidently classify Mainboard vs SME from the GMP page alone — skip rather than guess.
          const gmp = parseNum(row.gmp);
          if (gmp == null) continue;
          ipos.push({ name: row.name.trim(), type, gmp, sourceUrl: REPORT_URLS.gmp });
        }
      }
    }

    if (ipos.length === 0) {
      warnings.push(
        "Chittorgarh responded but no usable rows were extracted — see the warnings above for which page(s) failed to parse."
      );
    }

    return { ipos, warnings };
  },
};
