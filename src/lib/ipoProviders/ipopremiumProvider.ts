// ============================================================================
// IPOPremium provider — a secondary, explicitly NON-official source
// (isOfficial: false) that fills in what NSE's endpoint usually doesn't
// publish before/around an issue opening: lot size, allotment/listing
// dates, and (like every GMP source, always) grey market premium.
//
// IMPORTANT CAVEAT (read before debugging a zero-rows warning): this
// sandbox's network policy blocks ipopremium.in — confirmed by testing
// (curl gets a 403 from the sandbox's own outbound proxy before ever
// reaching the site), so its exact page structure could not be verified
// before shipping. Deliberately narrower in scope than the two prior
// attempts at a secondary source:
//   - chittorgarhProvider.ts guessed specific report-page URLs from
//     memory; turned out those pages are JavaScript-rendered.
//   - ipowatchProvider.ts crawled outward from the homepage to any
//     link that merely *looked* IPO-related, which is what let it latch
//     onto an unrelated table and insert a garbage row.
// This provider only ever fetches the homepage — no link-following. If
// ipopremium.in's live IPO/GMP table isn't reachable directly from
// https://www.ipopremium.in/, this returns zero rows with the raw table
// headers it actually saw (Settings page fetch-log warning) rather than
// guess at subpage URLs a third time. That diagnostic — not another
// blind attempt — is what should drive the next change here.
//
// Row-level defense in depth regardless of what this returns:
// normalizedIpoSchema.ts rejects any row whose "name" isn't a plausible
// company name (must start with a letter/digit, no currency symbols or
// template brackets) before it ever reaches the database — added after
// the ipowatch incident specifically to catch this class of mistake.
//
// Never merges its own company-name spelling over an existing row's name —
// see resolveIpoId()/applyNormalizedIpo() in ipoSync.ts, which fuzzy-matches
// this provider's rows onto whatever NSE already created and keeps NSE's
// spelling. GMP from here is still always unofficial, same as any source.
// ============================================================================

import { extractTables, fetchPage, parseDate, parseNum, parsePriceBand, type TableRowData } from "./htmlTableUtils";
import type { IpoDataProvider, NormalizedIpo, ProviderFetchResult } from "./types";
import type { IpoType } from "@/types";

const HOMEPAGE_URL = "https://www.ipopremium.in/";

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

function classifyType(text: string): IpoType {
  return text.toLowerCase().includes("sme") ? "SME" : "Mainboard";
}

function rowsToNormalized(rows: TableRowData[], sourceUrl: string): NormalizedIpo[] {
  const out: NormalizedIpo[] = [];
  for (const row of rows) {
    if (!row.name || row.name.trim().length < 2) continue;
    const priceBand = row.price ? parsePriceBand(row.price) : {};
    out.push({
      name: row.name.trim(),
      type: classifyType(row.name),
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
      // this source's table — leaving it unset is safer than guessing.
      sourceUrl,
    });
  }
  return out;
}

export const ipopremiumProvider: IpoDataProvider = {
  key: "ipopremium",
  displayName: "IPOPremium",
  isOfficial: false,

  async fetch(): Promise<ProviderFetchResult> {
    const page = await fetchPage(HOMEPAGE_URL);
    if (!page.ok) {
      return { ipos: [], warnings: [page.warning] };
    }

    const { tables, diagnostics } = extractTables(page.$, COLUMN_ALIASES);
    if (tables.length === 0) {
      return {
        ipos: [],
        warnings: [
          `No recognizable IPO table found on ${HOMEPAGE_URL}. Tables seen: ${JSON.stringify(diagnostics)}`,
        ],
      };
    }

    const ipos = tables.flatMap((rows) => rowsToNormalized(rows, HOMEPAGE_URL));
    const warnings =
      ipos.length === 0
        ? [`${HOMEPAGE_URL} had table(s) but no usable rows were extracted from them.`]
        : [];
    return { ipos, warnings };
  },
};
