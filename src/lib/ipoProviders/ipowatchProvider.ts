// ============================================================================
// IPOWatch provider — DISABLED, not registered in ipoSync.ts's PROVIDERS
// list. The homepage-crawl-and-guess approach (see below) was tried in
// production and confirmed to cause two real problems, not hypothetical
// ones: it inserted a garbage row ("₹[.] Cr.", a template placeholder
// string it mistook for a company name from a mismatched table), and it
// contributed to a real "Refresh IPO Data" click taking ~5 minutes before
// timing out. Broadly crawling "any link that looks IPO-related" and
// trusting "any table with a name-like column" is inherently too loose —
// it can latch onto the wrong table on a page that wasn't the intended
// target at all. Left in the codebase as a starting point for a future
// attempt scoped to specific, verified page(s) instead of an open crawl.
//
// Original design intent, preserved for that future attempt: a secondary,
// explicitly NON-official source (isOfficial: false) filling in what
// NSE's endpoint doesn't publish — lot size, allotment/listing dates, GMP
// — reached via plain public pages, no login/CAPTCHA/Cloudflare bypass.
// This sandbox's network policy blocks ipowatch.in, so its exact page
// structure and URLs were never verified before the crawl approach was
// tried — chosen after chittorgarh.com turned out to be JavaScript-
// rendered (unfixable via a plain fetch). Rather than hardcode guessed
// report-page URLs a second time, this crawled outward from the
// homepage: fetch it, try to read a table directly off it, and follow
// any links whose href/text look IPO-related (see findCandidateLinks in
// htmlTableUtils.ts) to a bounded set of subpages. That's the part that
// needs to be replaced with specific, human-verified URLs before this
// is re-enabled — not the parsing logic itself, which is unchanged from
// chittorgarhProvider.ts's approach and worked correctly there.
//
// Never merges its own company-name spelling over an existing row's name —
// see resolveIpoId()/applyNormalizedIpo() in ipoSync.ts, which fuzzy-matches
// this provider's rows onto whatever NSE already created and keeps NSE's
// spelling. GMP from here is still always unofficial, same as any source.
// ============================================================================

import {
  extractTables,
  fetchPage,
  findCandidateLinks,
  parseDate,
  parseNum,
  parsePriceBand,
  type TableRowData,
} from "./htmlTableUtils";
import type { IpoDataProvider, NormalizedIpo, ProviderFetchResult } from "./types";
import type { IpoType } from "@/types";

const HOMEPAGE_URL = "https://ipowatch.in/";
const LINK_KEYWORDS = ["ipo", "gmp", "grey-market", "mainboard", "sme", "calendar", "upcoming"];
const MAX_SUBPAGES = 6;

const COLUMN_ALIASES: Record<string, string[]> = {
  name: ["iponame", "companyname", "nameofissue", "issuername", "ipo"],
  open: ["opendate", "openingdate", "issueopen", "biddingstartdate", "open"],
  close: ["closedate", "closingdate", "issueclose", "biddingenddate", "close"],
  allotment: ["allotmentdate", "basisofallotment", "boa", "allotment"],
  listing: ["listingdate", "listingon", "listing"],
  lotSize: ["lotsize", "marketlot", "minlot"],
  price: ["issueprice", "priceband", "pricerange", "price"],
  issueSize: ["issuesize", "iposize"],
  gmp: ["gmp", "greymarketpremium", "premium"],
};

function classifyType(url: string): IpoType {
  return url.toLowerCase().includes("sme") ? "SME" : "Mainboard";
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
      // No exchange guess: can't reliably tell BSE vs NSE per row from
      // this source's tables — leaving it unset is safer than guessing.
      sourceUrl,
    });
  }
  return out;
}

export const ipowatchProvider: IpoDataProvider = {
  key: "ipowatch",
  displayName: "IPOWatch",
  isOfficial: false,

  async fetch(): Promise<ProviderFetchResult> {
    const warnings: string[] = [];
    const ipos: NormalizedIpo[] = [];
    const seenDiagnostics: string[] = [];

    const home = await fetchPage(HOMEPAGE_URL);
    if (!home.ok) {
      return { ipos: [], warnings: [home.warning] };
    }

    // Try the homepage itself first — some trackers put a live IPO table
    // directly on the front page.
    const homeTables = extractTables(home.$, COLUMN_ALIASES);
    if (homeTables.tables.length > 0) {
      for (const rows of homeTables.tables) {
        ipos.push(...rowsToNormalized(rows, classifyType(HOMEPAGE_URL), HOMEPAGE_URL));
      }
    } else if (homeTables.diagnostics) {
      seenDiagnostics.push(`${HOMEPAGE_URL} -> ${JSON.stringify(homeTables.diagnostics)}`);
    }

    const candidates = findCandidateLinks(home.$, HOMEPAGE_URL, LINK_KEYWORDS).slice(0, MAX_SUBPAGES);
    const subpages = await Promise.all(
      candidates.map(async (url) => ({ url, result: await fetchPage(url) }))
    );

    for (const { url, result } of subpages) {
      if (!result.ok) {
        seenDiagnostics.push(`${url} -> ${result.warning}`);
        continue;
      }
      const { tables, diagnostics } = extractTables(result.$, COLUMN_ALIASES);
      if (tables.length === 0) {
        if (diagnostics) seenDiagnostics.push(`${url} -> ${JSON.stringify(diagnostics)}`);
        continue;
      }
      for (const rows of tables) {
        ipos.push(...rowsToNormalized(rows, classifyType(url), url));
      }
    }

    if (ipos.length === 0) {
      warnings.push(
        `No usable IPO table found on ${HOMEPAGE_URL} or ${candidates.length} linked page(s) it pointed to ` +
          `(${JSON.stringify(candidates)}). Table headers actually seen: ${JSON.stringify(seenDiagnostics.slice(0, 8))}`
      );
    }

    return { ipos, warnings };
  },
};
