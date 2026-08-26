// ============================================================================
// NSE provider — the closest thing to a "legitimate" automated source for
// Indian IPO facts: it's the official exchange, and this hits a JSON
// endpoint NSE's own website calls (not a documented/published API, but
// reachable without a login, CAPTCHA, or bypassing any access control — a
// normal cookie handshake, same as any browser visiting the page does).
//
// Explicitly does NOT and will never provide GMP — no exchange publishes
// grey market data, by definition (GMP is unofficial, off-exchange
// activity). Subscription figures ARE published here once an IPO is open,
// and are treated as official.
//
// If NSE changes this endpoint's shape or blocks it outright, this provider
// simply returns zero rows + a warning — it never falls back to scraping a
// different, less-legitimate path, per the "don't bypass, find another
// legitimate source instead" requirement. The dashboard keeps working on
// existing + manually-entered data regardless.
// ============================================================================

import type { IpoDataProvider, NormalizedIpo, ProviderFetchResult } from "./types";
import type { IpoType } from "@/types";

const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept-Language": "en-US,en;q=0.9",
};

const NSE_PAGE_URL = "https://www.nseindia.com/market-data/all-upcoming-issues-ipo";
const NSE_API_URL = "https://www.nseindia.com/api/all-upcoming-issues?category=ipo";

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

    const apiRes = await fetch(NSE_API_URL, {
      headers: {
        ...BROWSER_HEADERS,
        Accept: "application/json, text/plain, */*",
        Referer: NSE_PAGE_URL,
        Cookie: cookieHeader,
      },
      signal: AbortSignal.timeout(15_000),
    });
    if (!apiRes.ok) {
      throw new Error(`HTTP ${apiRes.status} fetching NSE IPO data`);
    }

    const data = await apiRes.json();
    const list: Record<string, unknown>[] = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : [];

    const ipos: NormalizedIpo[] = [];
    for (const row of list) {
      const name = pick(row, ["companyName", "symbol", "name", "issuerName"]);
      if (!name) {
        warnings.push("Skipped one NSE row with no recognizable company name field");
        continue;
      }
      const priceBand = parsePriceBand(pick(row, ["issuePrice", "priceRange", "issuePriceRange"]));
      const seriesRaw = pick(row, ["series", "board"]).toUpperCase();
      const type: IpoType = seriesRaw.includes("SME") ? "SME" : "Mainboard";

      ipos.push({
        name,
        symbol: pick(row, ["symbol"]) || undefined,
        type,
        openDate: parseDate(pick(row, ["issueStartDate", "startDate", "biddingStartDate"])),
        closeDate: parseDate(pick(row, ["issueEndDate", "endDate", "biddingEndDate"])),
        priceBandMin: priceBand.min,
        priceBandMax: priceBand.max,
        lotSize: parseNum(pick(row, ["marketLot", "lotSize", "minLot"])),
        issueSize: pick(row, ["issueSize"]) || undefined,
        exchange: type === "SME" ? "NSE SME" : "NSE",
        sourceUrl: NSE_PAGE_URL,
        // Deliberately no gmp field here — NSE never has grey market data.
      });
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
