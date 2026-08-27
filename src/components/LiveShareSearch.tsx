"use client";

import { useState } from "react";
import { Search, TrendingUp, TrendingDown, Loader2, ExternalLink } from "lucide-react";

interface LiveQuote {
  symbol: string;
  exchange: "NSE" | "BSE";
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

interface QuoteResponse {
  nse: LiveQuote | null;
  bse: LiveQuote | null;
  nseError?: string;
  bseError?: string;
}

/**
 * Live share price — Yahoo Finance's chart API (see src/lib/stockQuote.ts
 * for the full reasoning), fetched inline for both NSE and BSE. Falls back
 * to a Google search link only if BOTH exchanges fail to return data, so
 * there's always a way to see a price even if this integration breaks.
 */
export function LiveShareSearch() {
  const [input, setInput] = useState("");
  const [searched, setSearched] = useState<string | null>(null);
  const [data, setData] = useState<QuoteResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) return;
    setLoading(true);
    setError(null);
    setData(null);
    setSearched(trimmed);
    try {
      const res = await fetch(`/api/stock-quote?symbol=${encodeURIComponent(trimmed)}`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError("Couldn't find a live price for that symbol on either exchange.");
        // Kept even on total failure — this is exactly the diagnostic
        // evidence (the real upstream error/response) needed to fix a
        // wrong assumption about the data source, same lesson learned the
        // hard way debugging NSE's endpoint earlier.
        setData({ nse: null, bse: null, nseError: json?.nseError, bseError: json?.bseError });
        return;
      }
      setData(json as QuoteResponse);
    } catch {
      setError("Lookup failed.");
    } finally {
      setLoading(false);
    }
  }

  function googleSearchUrl(query: string): string {
    return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
  }

  return (
    <div className="card">
      <h3 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">Live Share Price</h3>
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
          <input
            className="input pl-9"
            placeholder="Symbol — e.g. TCS, INFY, RELIANCE"
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
        </div>
        <button type="submit" className="btn-primary shrink-0" disabled={loading || !input.trim()}>
          {loading ? <Loader2 size={15} className="animate-spin" /> : "Search"}
        </button>
      </form>

      {error && searched && (
        <div className="mt-3">
          <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-900/30 dark:text-red-300">
            {error}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <a
              href={googleSearchUrl(`${searched} share price NSE`)}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary flex items-center gap-1.5 text-xs"
            >
              <ExternalLink size={12} /> {searched} on NSE (Google)
            </a>
            <a
              href={googleSearchUrl(`${searched} share price BSE`)}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary flex items-center gap-1.5 text-xs"
            >
              <ExternalLink size={12} /> {searched} on BSE (Google)
            </a>
          </div>
        </div>
      )}

      {data && (
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {(["nse", "bse"] as const).map((key) => {
            const quote = data[key];
            const err = key === "nse" ? data.nseError : data.bseError;
            if (!quote) {
              return err ? (
                <details
                  key={key}
                  className="rounded-lg border border-slate-100 p-3 text-xs text-slate-400 dark:border-slate-800"
                >
                  <summary className="cursor-pointer">{key.toUpperCase()}: not available</summary>
                  <p className="mt-1 whitespace-pre-wrap break-all text-slate-500 dark:text-slate-400">{err}</p>
                </details>
              ) : null;
            }
            const isUp = (quote.change ?? 0) >= 0;
            return (
              <div key={key} className="rounded-lg border border-slate-100 p-3 dark:border-slate-800">
                <div className="flex items-baseline justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                      {quote.companyName || quote.symbol}
                    </p>
                    <p className="text-xs text-slate-400">
                      {quote.symbol} · {quote.exchange}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-slate-900 dark:text-white">
                      ₹{quote.lastPrice.toFixed(2)}
                    </p>
                    {quote.change != null && (
                      <p
                        className={`flex items-center justify-end gap-1 text-xs font-medium ${
                          isUp ? "text-emerald-600" : "text-red-600"
                        }`}
                      >
                        {isUp ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                        {quote.change.toFixed(2)} ({quote.percentChange?.toFixed(2)}%)
                      </p>
                    )}
                  </div>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                  <span>Prev. Close: ₹{quote.previousClose?.toFixed(2) ?? "—"}</span>
                  <span>
                    Day: ₹{quote.dayLow?.toFixed(2) ?? "—"}–{quote.dayHigh?.toFixed(2) ?? "—"}
                  </span>
                  <span className="col-span-2">
                    52W: ₹{quote.yearLow?.toFixed(2) ?? "—"}–{quote.yearHigh?.toFixed(2) ?? "—"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
