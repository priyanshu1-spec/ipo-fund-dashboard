// ============================================================================
// Chittorgarh provider — DISABLED, not registered in ipoSync.ts's PROVIDERS
// list. Confirmed (not just suspected) that chittorgarh.com's report pages
// return zero <table> elements in their raw HTML — the data is rendered
// client-side by JavaScript a plain server-side fetch never executes. Not a
// fixable selector/markup problem without a headless browser (Puppeteer/
// Playwright), which is a poor fit for a Vercel serverless function.
//
// Left in place in case chittorgarh.com (or a fork of this file pointed at
// a different source) ever exposes the same fields via a real HTML table or
// JSON endpoint — see htmlTableUtils.ts for the shared, header-text-driven
// parsing helpers this and ipowatchProvider.ts both use.
// ============================================================================

import {
  extractTables,
  fetchPage,
  normalizeCompanyName,
  parseDate,
  parseNum,
  parsePriceBand,
  type TableRowData,
} from "./htmlTableUtils";
import type { IpoDataProvider, NormalizedIpo, ProviderFetchResult } from "./types";
import type { IpoType } from "@/types";

const REPORT_URLS = {
  mainboard: "https://www.chittorgarh.com/report/mainboard-ipo-list-in-india-bse-nse/83/",
  sme: "https://www.chittorgarh.com/report/sme-ipo-list-in-india-bse-sme-nse-emerge/22/",
  gmp: "https://www.chittorgarh.com/report/latest-ipo-gmp-grey-market-premium/23/",
};

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
      const { tables, diagnostics } = extractTables(page.$, COLUMN_ALIASES);
      if (tables.length === 0) {
        warnings.push(
          `No recognizable data table found on ${url}. Tables seen: ${JSON.stringify(diagnostics)}`
        );
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
      const { tables, diagnostics } = extractTables(gmpPage.$, COLUMN_ALIASES);
      if (tables.length === 0) {
        warnings.push(
          `No recognizable data table found on ${REPORT_URLS.gmp}. Tables seen: ${JSON.stringify(diagnostics)}`
        );
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
