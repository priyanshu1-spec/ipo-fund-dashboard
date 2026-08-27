// ============================================================================
// Live share price — Yahoo Finance's chart/quote endpoint, not NSE. NSE's
// own quote-equity endpoint hit a confirmed Akamai bot-management block
// (a real "Access Denied" page — see git history for chronology); Google
// search-results scraping was ruled out outright (against Google's ToS,
// stronger anti-bot than NSE's, and this app's own "never bypass a
// CAPTCHA/rate-limit" principle already ruled out doing exactly this to
// NSE). Yahoo's endpoint is a genuinely different risk category: a plain
// JSON API, not a search-results page, and one long-used by the
// open-source finance community (yfinance and many JS equivalents rely on
// exactly this URL) rather than something whose Terms explicitly forbid
// automated access.
//
// HONEST CAVEAT, same as every other integration in this app: the exact
// response shape below (chart.result[0].meta...) comes from general
// knowledge of this endpoint, not a live fetch — this sandbox can't reach
// query1.finance.yahoo.com either. Parsing is defensive and captures the
// raw response on a shape mismatch or non-2xx, so a wrong guess is
// diagnosable from one real attempt instead of another blind one.
//
// NSE symbols get ".NS" appended, BSE gets ".BO" — Yahoo's own suffix
// convention for Indian exchanges.
// ============================================================================

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "application/json, text/plain, */*",
};

const CHART_API_BASE = "https://query1.finance.yahoo.com/v8/finance/chart";
const SEARCH_API_BASE = "https://query1.finance.yahoo.com/v1/finance/search";

export type Exchange = "NSE" | "BSE";

export interface LiveQuote {
  symbol: string;
  exchange: Exchange;
  companyName?: string;
  currency?: string;
  lastPrice: number;
  previousClose?: number;
  change?: number;
  percentChange?: number;
  dayHigh?: number;
  dayLow?: number;
  yearHigh?: number;
  yearLow?: number;
  fetchedAt: string;
}

export type LiveQuoteResult = { ok: true; quote: LiveQuote } | { ok: false; error: string };

function num(v: unknown): number | undefined {
  const n = typeof v === "number" ? v : typeof v === "string" ? parseFloat(v) : NaN;
  return Number.isFinite(n) ? n : undefined;
}

const SUFFIX: Record<Exchange, string> = { NSE: ".NS", BSE: ".BO" };
// Yahoo's own exchange codes for the two Indian exchanges, as seen in its
// search endpoint's results.
const INDIA_EXCHANGE_CODES = new Set(["NSI", "BSE"]);

export interface ResolvedSymbol {
  symbol: string;
  name?: string;
}

/**
 * Resolves a free-text query (a company name, a partial name, or an exact
 * ticker) to a bare NSE/BSE trading symbol via Yahoo's own search/
 * autocomplete endpoint — the same one Yahoo Finance's own site uses, and
 * the same family of API as the chart endpoint below (same honest caveat:
 * exact field names are from general knowledge, not a verified live
 * fetch). Returns undefined (not an error) when nothing matches, so the
 * caller can fall back to treating the raw input as an exact symbol —
 * that keeps a plain ticker search working even if this resolution step
 * itself fails or Yahoo changes its search response shape.
 */
export async function resolveQuery(query: string): Promise<ResolvedSymbol | undefined> {
  const trimmed = query.trim();
  if (!trimmed) return undefined;
  try {
    const res = await fetch(
      `${SEARCH_API_BASE}?q=${encodeURIComponent(trimmed)}&quotesCount=10&newsCount=0`,
      { headers: HEADERS, signal: AbortSignal.timeout(10_000) }
    );
    if (!res.ok) return undefined;
    const data = await res.json();
    const quotes = Array.isArray(data?.quotes) ? (data.quotes as Record<string, unknown>[]) : [];
    const match = quotes.find(
      (q) =>
        q.quoteType === "EQUITY" &&
        typeof q.exchange === "string" &&
        INDIA_EXCHANGE_CODES.has(q.exchange) &&
        typeof q.symbol === "string"
    );
    if (!match) return undefined;
    const rawSymbol = String(match.symbol);
    const bareSymbol = rawSymbol.replace(/\.(NS|BO)$/i, "");
    const name = typeof match.longname === "string" ? match.longname : typeof match.shortname === "string" ? match.shortname : undefined;
    return { symbol: bareSymbol, name };
  } catch {
    return undefined;
  }
}

export async function fetchLiveQuote(rawSymbol: string, exchange: Exchange): Promise<LiveQuoteResult> {
  const symbol = rawSymbol.trim().toUpperCase();
  if (!symbol || !/^[A-Z0-9&.\-]{1,20}$/.test(symbol)) {
    return { ok: false, error: "Enter a valid trading symbol or company name." };
  }

  const yahooSymbol = `${symbol}${SUFFIX[exchange]}`;
  try {
    const res = await fetch(`${CHART_API_BASE}/${encodeURIComponent(yahooSymbol)}`, {
      headers: HEADERS,
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) {
      const bodySnippet = await res.text().catch(() => "");
      return {
        ok: false,
        error: `${exchange} lookup failed (HTTP ${res.status}). Response: ${bodySnippet.slice(0, 300) || "(empty)"}`,
      };
    }

    const data = await res.json();
    const result = data?.chart?.result?.[0];
    const chartError = data?.chart?.error;
    if (chartError) {
      return { ok: false, error: `No ${exchange} symbol "${symbol}" found (${chartError.description ?? "not found"}).` };
    }
    const meta = (result?.meta ?? {}) as Record<string, unknown>;

    const lastPrice = num(meta.regularMarketPrice);
    if (lastPrice == null) {
      return {
        ok: false,
        error: `Yahoo responded but no usable price found for ${exchange}. Raw response: ${JSON.stringify(data).slice(0, 500)}`,
      };
    }

    const previousClose = num(meta.previousClose) ?? num(meta.chartPreviousClose);
    const change = previousClose != null ? lastPrice - previousClose : undefined;
    const percentChange = change != null && previousClose ? (change / previousClose) * 100 : undefined;

    return {
      ok: true,
      quote: {
        symbol,
        exchange,
        companyName: typeof meta.longName === "string" ? meta.longName : typeof meta.shortName === "string" ? meta.shortName : undefined,
        currency: typeof meta.currency === "string" ? meta.currency : undefined,
        lastPrice,
        previousClose,
        change,
        percentChange,
        dayHigh: num(meta.regularMarketDayHigh),
        dayLow: num(meta.regularMarketDayLow),
        yearHigh: num(meta.fiftyTwoWeekHigh),
        yearLow: num(meta.fiftyTwoWeekLow),
        fetchedAt: new Date().toISOString(),
      },
    };
  } catch (err) {
    return { ok: false, error: `Failed to fetch ${exchange} quote: ${err instanceof Error ? err.message : String(err)}` };
  }
}
