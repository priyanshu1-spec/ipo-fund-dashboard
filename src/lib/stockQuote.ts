// ============================================================================
// Live share price lookup — reuses the exact NSE access pattern that's
// already proven reliable in this app (nseProvider.ts): a normal cookie
// handshake against a public NSE page, then a JSON endpoint NSE's own site
// calls, no login/CAPTCHA/Cloudflare bypass involved. NSE's IPO endpoint
// via this pattern has consistently returned correct data (name, dates,
// price band) every time it's been tested live, which is a meaningfully
// better starting point than a brand-new, never-tested site.
//
// HONEST CAVEAT: the exact field names below (priceInfo.lastPrice, etc.)
// come from general knowledge of NSE's quote-equity endpoint, not a live
// fetch from this sandbox — its network policy blocks nseindia.com same as
// everywhere else. Parsing is defensive (tries several plausible key
// paths, never throws on a missing one) and captures the raw response on
// failure so a wrong guess is diagnosable from one real attempt instead of
// requiring another blind one — same approach that already fixed the IPO
// providers' field-name issues for real.
// ============================================================================

const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept-Language": "en-US,en;q=0.9",
};

function quotePageUrl(symbol: string): string {
  return `https://www.nseindia.com/get-quotes/equity?symbol=${encodeURIComponent(symbol)}`;
}

const QUOTE_API_BASE = "https://www.nseindia.com/api/quote-equity";

export interface LiveQuote {
  symbol: string;
  companyName?: string;
  lastPrice: number;
  change?: number;
  percentChange?: number;
  previousClose?: number;
  open?: number;
  dayHigh?: number;
  dayLow?: number;
  yearHigh?: number;
  yearLow?: number;
  /** ISO timestamp of when this was fetched — always "as of now," NSE quotes are near-real-time but not tick-by-tick live streaming. */
  fetchedAt: string;
}

export type LiveQuoteResult = { ok: true; quote: LiveQuote } | { ok: false; error: string };

function num(v: unknown): number | undefined {
  const n = typeof v === "number" ? v : typeof v === "string" ? parseFloat(v) : NaN;
  return Number.isFinite(n) ? n : undefined;
}

export async function fetchLiveQuote(rawSymbol: string): Promise<LiveQuoteResult> {
  const symbol = rawSymbol.trim().toUpperCase();
  if (!symbol || !/^[A-Z0-9&.\-]{1,20}$/.test(symbol)) {
    return { ok: false, error: "Enter a valid NSE trading symbol (e.g. TCS, INFY, RELIANCE)." };
  }

  try {
    const pageUrl = quotePageUrl(symbol);
    // Cookie step uses the plain NSE homepage — the exact mechanism
    // nseProvider.ts already uses successfully for IPO data — rather than
    // the symbol-specific quote page. A first attempt using the quote page
    // itself for both cookies and Referer got HTTP 403; a per-symbol page
    // is more plausibly behind stricter bot detection than NSE's most
    // generic entry point.
    const homepageRes = await fetch("https://www.nseindia.com/", {
      headers: { ...BROWSER_HEADERS, Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8" },
      signal: AbortSignal.timeout(12_000),
    });
    if (!homepageRes.ok) {
      return { ok: false, error: `NSE unreachable (HTTP ${homepageRes.status}) — try again in a moment.` };
    }
    const setCookieHeaders =
      typeof homepageRes.headers.getSetCookie === "function"
        ? homepageRes.headers.getSetCookie()
        : (homepageRes.headers.get("set-cookie") ?? "").split(/,(?=[^;]+=[^;]+)/);
    const cookieHeader = setCookieHeaders
      .map((c) => c.split(";")[0])
      .filter(Boolean)
      .join("; ");

    const apiRes = await fetch(`${QUOTE_API_BASE}?symbol=${encodeURIComponent(symbol)}`, {
      headers: {
        ...BROWSER_HEADERS,
        Accept: "application/json, text/plain, */*",
        Referer: pageUrl,
        Cookie: cookieHeader,
      },
      signal: AbortSignal.timeout(12_000),
    });
    if (apiRes.status === 404) {
      return { ok: false, error: `No NSE-listed symbol "${symbol}" found. Check the spelling/ticker.` };
    }
    if (!apiRes.ok) {
      // Capture what NSE actually sent back — a 403 could mean a WAF/
      // Cloudflare challenge page (unfixable by header tweaks, needs a
      // different approach entirely) or a plain rejected request (might
      // just need a different header). This is the evidence needed to
      // tell those apart instead of guessing headers blind.
      const bodySnippet = await apiRes.text().catch(() => "");
      return {
        ok: false,
        error: `NSE quote lookup failed (HTTP ${apiRes.status}). Response: ${bodySnippet.slice(0, 300) || "(empty)"}`,
      };
    }

    const data = await apiRes.json();
    const priceInfo = (data?.priceInfo ?? {}) as Record<string, unknown>;
    const info = (data?.info ?? {}) as Record<string, unknown>;
    const intraDay = (priceInfo?.intraDayHighLow ?? {}) as Record<string, unknown>;
    const weekRange = (priceInfo?.weekHighLow ?? {}) as Record<string, unknown>;

    const lastPrice = num(priceInfo.lastPrice) ?? num(priceInfo.close);
    if (lastPrice == null) {
      // Field-name mismatch, not a "symbol doesn't exist" case (that's the
      // 404 branch above) — surface exactly what NSE actually sent back so
      // this is fixable from one real report instead of another guess.
      return {
        ok: false,
        error: `NSE responded but no usable price found. Raw response: ${JSON.stringify(data).slice(0, 500)}`,
      };
    }

    return {
      ok: true,
      quote: {
        symbol,
        companyName: typeof info.companyName === "string" ? info.companyName : undefined,
        lastPrice,
        change: num(priceInfo.change),
        percentChange: num(priceInfo.pChange),
        previousClose: num(priceInfo.previousClose),
        open: num(priceInfo.open),
        dayHigh: num(intraDay.max),
        dayLow: num(intraDay.min),
        yearHigh: num(weekRange.max),
        yearLow: num(weekRange.min),
        fetchedAt: new Date().toISOString(),
      },
    };
  } catch (err) {
    return {
      ok: false,
      error: `Failed to fetch: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
