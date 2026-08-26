// ============================================================================
// IPOWatch provider — a secondary, explicitly NON-official source
// (isOfficial: false) that fills in what NSE's endpoint usually doesn't
// publish before/around an issue opening: lot size, allotment/listing
// dates, and (like every GMP source, always) grey market premium. Reached
// via plain public pages — no login, CAPTCHA, or Cloudflare bypass
// involved; if that ever changes, this provider is meant to fail closed
// (return zero rows + a warning), same contract as nseProvider.
//
// IMPORTANT CAVEAT (read before debugging a zero-rows warning): this
// sandbox's network policy blocks ipowatch.in, so its exact page
// structure and URLs could not be verified before shipping — chosen after
// chittorgarh.com turned out to be JavaScript-rendered (unfixable via a
// plain fetch). Rather than hardcode guessed report-page URLs a second
// time, this crawls outward from the homepage: fetch it, try to read a
// table directly off it, and separately follow any links whose href/text
// look IPO-related (see findCandidateLinks in htmlTableUtils.ts) to a
// bounded set of subpages, extracting a table from each. If ipowatch.in's
// real layout doesn't match, the fetch-log warning (Settings page) lists
// every candidate URL this actually found and tried, plus the raw
// headers of any table it saw on each — enough to fix the column aliases
// below in one round trip instead of guessing again.
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
