// ============================================================================
// NSE provider — the closest thing to a "legitimate" automated source for
// Indian IPO facts: it's the official exchange, and this hits a JSON
// endpoint NSE's own website calls (not a documented/published API, but
// reachable without a login, CAPTCHA, or bypassing any access control — a
// normal cookie handshake, same as any browser visiting the page does).
//
// NSE exposes Mainboard and SME issues as two SEPARATE category feeds off
// the same endpoint (?category=ipo vs ?category=sme) — they are not merged
// server-side, so both must be fetched independently or SME rows never
// appear at all.
//
// Explicitly does NOT and will never provide GMP — no exchange publishes
// grey market data, by definition (GMP is unofficial, off-exchange
// activity). Subscription figures ARE published here once an IPO is open,
// and are treated as official.
//
// Field-name note: NSE's response shape isn't documented and has drifted
// before, and several fields (lot size, allotment/listing dates) are often
// simply not published yet for an issue still in "Upcoming" status — that's
// a real gap in NSE's own data, not a bug here. `pick()` tries several
// known/plausible field-name variants per value and only fills a field when
// one actually matches; anything it can't find is left undefined rather
// than guessed at, so a missing field never becomes a fabricated 0 or date.
//
// If NSE changes this endpoint's shape or blocks it outright, this provider
// simply returns zero rows + a warning — it never falls back to scraping a
// different, less-legitimate path, per the "don't bypass, find another
// legitimate source instead" requirement. The dashboard keeps working on
// existing + manually-entered data regardless.
// ============================================================================

import type { IpoDataProvider, NormalizedIpo, ProviderFetchResult } from "./types";
import type { IpoStatus, IpoType } from "@/types";

const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept-Language": "en-US,en;q=0.9",
};

const NSE_PAGE_URL = "https://www.nseindia.com/market-data/all-upcoming-issues-ipo";
const NSE_API_BASE = "https://www.nseindia.com/api/all-upcoming-issues";

function pick(row: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    if (row[k] !== undefined && row[k] !== null && row[k] !== "") return String(row[k]);
  }
  return "";
}

function parseDate(text: string): string | undefined {
  if (!text) return undefined;
  const parsed = new Date(text.trim());
  return isNaN(parsed.getTime()) ? undefined : parsed.toISOString().slice(0, 10);
}

function parseNum(text: string): number | undefined {
  if (!text) return undefined;
  const match = text.replace(/,/g, "").match(/-?\d+(\.\d+)?/);
  return match ? parseFloat(match[0]) : undefined;
}

function parsePriceBand(text: string): { min?: number; max?: number } {
  const nums = (text.match(/[\d,]+(\.\d+)?/g) ?? []).map((n) => parseFloat(n.replace(/,/g, "")));
  if (nums.length === 0) return {};
  if (nums.length === 1) return { min: nums[0], max: nums[0] };
  return { min: Math.min(...nums), max: Math.max(...nums) };
}

const STATUS_MAP: Record<string, IpoStatus> = {
  upcoming: "Upcoming",
  forthcoming: "Upcoming",
  active: "Open",
  open: "Open",
  current: "Open",
  closed: "Closed",
  close: "Closed",
  "allotment awaited": "Allotment Awaited",
  allotted: "Allotted",
  listed: "Listed",
};

function parseStatus(text: string): IpoStatus | undefined {
  return STATUS_MAP[text.trim().toLowerCase()];
}

async function fetchCategory(
  category: "ipo" | "sme",
  cookieHeader: string
): Promise<{ rows: Record<string, unknown>[]; warning?: string }> {
  const apiRes = await fetch(`${NSE_API_BASE}?category=${category}`, {
    headers: {
      ...BROWSER_HEADERS,
      Accept: "application/json, text/plain, */*",
      Referer: NSE_PAGE_URL,
      Cookie: cookieHeader,
    },
    signal: AbortSignal.timeout(15_000),
  });
  if (!apiRes.ok) {
    return { rows: [], warning: `HTTP ${apiRes.status} fetching NSE ${category.toUpperCase()} IPO data` };
  }
  const data = await apiRes.json();
  const rows: Record<string, unknown>[] = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : [];
  return { rows };
}

interface NormalizedRowResult {
  ipo?: NormalizedIpo;
  /** Populated only when lot size came back empty — the row's actual raw keys+values, so a fetch-log warning can show definitively whether NSE has this field under a different name or genuinely omits it for this row, instead of guessing at key names a third time. */
  lotSizeDiagnostic?: string;
}

function normalizeRow(row: Record<string, unknown>, type: IpoType): NormalizedRowResult {
  const name = pick(row, ["companyName", "symbol", "name", "issuerName"]);
  if (!name) return {};

  const priceBand = parsePriceBand(pick(row, ["issuePrice", "priceRange", "issuePriceRange"]));
  const status = parseStatus(pick(row, ["status", "issueStatus"]));
  const lotSize = parseNum(pick(row, ["marketLot", "lotSize", "minLot", "minOrderQuantity", "minBidQuantity"]));

  const ipo: NormalizedIpo = {
    name,
    symbol: pick(row, ["symbol"]) || undefined,
    type,
    issueType: pick(row, ["issueType", "typeOfIssue"]) || undefined,
    openDate: parseDate(pick(row, ["issueStartDate", "startDate", "biddingStartDate"])),
    closeDate: parseDate(pick(row, ["issueEndDate", "endDate", "biddingEndDate"])),
    allotmentDate: parseDate(
      pick(row, ["allotmentDate", "basisOfAllotmentDate", "tentativeAllotmentDate", "allotmentFinalisationDate"])
    ),
    listingDate: parseDate(pick(row, ["listingDate", "tentativeListingDate", "listingOn", "listedDate"])),
    priceBandMin: priceBand.min,
    priceBandMax: priceBand.max,
    faceValue: parseNum(pick(row, ["faceValue", "face_value"])),
    lotSize,
    issueSize: pick(row, ["issueSize"]) || undefined,
    status,
    registrar: pick(row, ["registrar", "rta", "registrarToIssue"]) || undefined,
    leadManagers: pick(row, ["leadManager", "leadManagers", "bookRunningLeadManager", "brlm"]) || undefined,
    exchange: type === "SME" ? "NSE SME" : "NSE",
    sourceUrl: NSE_PAGE_URL,
    // Deliberately no gmp field here — NSE never has grey market data.
  };

  return {
    ipo,
    lotSizeDiagnostic: lotSize == null ? `${name}: ${JSON.stringify(row)}` : undefined,
  };
}

export const nseProvider: IpoDataProvider = {
  key: "nse",
  displayName: "NSE",
  isOfficial: true,

  async fetch(): Promise<ProviderFetchResult> {
    const warnings: string[] = [];

    const homepageRes = await fetch(NSE_PAGE_URL, {
      headers: { ...BROWSER_HEADERS, Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8" },
      signal: AbortSignal.timeout(15_000),
    });
    if (!homepageRes.ok) {
      throw new Error(`HTTP ${homepageRes.status} fetching NSE homepage (cookie step)`);
    }

    const setCookieHeaders =
      typeof homepageRes.headers.getSetCookie === "function"
        ? homepageRes.headers.getSetCookie()
        : (homepageRes.headers.get("set-cookie") ?? "").split(/,(?=[^;]+=[^;]+)/);
    const cookieHeader = setCookieHeaders
      .map((c) => c.split(";")[0])
      .filter(Boolean)
      .join("; ");

    const [mainboard, sme] = await Promise.all([
      fetchCategory("ipo", cookieHeader),
      fetchCategory("sme", cookieHeader),
    ]);
    if (mainboard.warning) warnings.push(mainboard.warning);
    if (sme.warning) warnings.push(sme.warning);

    const ipos: NormalizedIpo[] = [];
    const lotSizeDiagnostics: string[] = [];
    function collect(rows: Record<string, unknown>[], type: IpoType) {
      for (const row of rows) {
        const { ipo, lotSizeDiagnostic } = normalizeRow(row, type);
        if (ipo) ipos.push(ipo);
        else warnings.push(`Skipped one NSE ${type} row with no recognizable company name field`);
        if (lotSizeDiagnostic && lotSizeDiagnostics.length < 2) lotSizeDiagnostics.push(lotSizeDiagnostic);
      }
    }
    collect(mainboard.rows, "Mainboard");
    collect(sme.rows, "SME");

    if (lotSizeDiagnostics.length > 0) {
      // Not a failure — most rows above got through fine — but this is
      // exactly the evidence needed to fix lot size parsing for real
      // instead of guessing at NSE's field names again: the actual raw
      // row NSE sent back, for up to 2 rows where lot size came back
      // empty, so whether the field exists under a different name (fix
      // the key list) or is genuinely absent from NSE's data for that
      // row (not fixable here) can be told apart with certainty.
      warnings.push(`Lot size missing — raw NSE row(s) for diagnosis: ${JSON.stringify(lotSizeDiagnostics)}`);
    }

    if (ipos.length === 0) {
      warnings.push(
        "NSE responded with no usable rows — its page may currently render this table via " +
          "JavaScript this fetch can't execute, or the field names in its response may have changed."
      );
    }

    return { ipos, warnings };
  },
};
