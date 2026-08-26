"use client";

import { useState } from "react";
import { Search, TrendingUp, TrendingDown, Loader2 } from "lucide-react";

interface LiveQuote {
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
  fetchedAt: string;
}

/**
 * Live NSE share price search — separate from the IPO data pipeline; this
 * looks up any NSE-listed stock on demand, not just IPO-linked ones.
 * Same underlying access pattern as nseProvider.ts (a normal cookie
 * handshake against a public NSE page, then its own JSON endpoint), which
 * has been reliable for IPO facts — see src/lib/stockQuote.ts for the
 * honest caveat on field-name confidence for this specific endpoint.
 */
export function LiveShareSearch() {
  const [input, setInput] = useState("");
  const [symbol, setSymbol] = useState<string | null>(null);
  const [quote, setQuote] = useState<LiveQuote | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) return;
    setLoading(true);
    setError(null);
    setQuote(null);
    setSymbol(trimmed.toUpperCase());
    try {
      const res = await fetch(`/api/stock-quote?symbol=${encodeURIComponent(trimmed)}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof data?.error === "string" ? data.error : `Lookup failed (${res.status})`);
      }
      setQuote(data.quote);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lookup failed");
    } finally {
      setLoading(false);
    }
  }

  const isUp = (quote?.change ?? 0) >= 0;

  return (
    <div className="card">
      <h3 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">Live Share Price</h3>
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
          <input
            className="input pl-9"
            placeholder="NSE symbol — e.g. TCS, INFY, RELIANCE"
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
        </div>
        <button type="submit" className="btn-primary shrink-0" disabled={loading || !input.trim()}>
          {loading ? <Loader2 size={15} className="animate-spin" /> : "Search"}
        </button>
      </form>

      {error && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-900/30 dark:text-red-300">
          {error}
        </p>
      )}

      {quote && !error && (
        <div className="mt-3 rounded-lg border border-slate-100 p-3 dark:border-slate-800">
          <div className="flex items-baseline justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                {quote.companyName || quote.symbol}
              </p>
              <p className="text-xs text-slate-400">{quote.symbol} · NSE</p>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold text-slate-900 dark:text-white">₹{quote.lastPrice.toFixed(2)}</p>
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
          <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400 sm:grid-cols-4">
            <span>Open: ₹{quote.open ?? "—"}</span>
            <span>Prev. Close: ₹{quote.previousClose ?? "—"}</span>
            <span>
              Day: ₹{quote.dayLow ?? "—"}–{quote.dayHigh ?? "—"}
            </span>
            <span>
              52W: ₹{quote.yearLow ?? "—"}–{quote.yearHigh ?? "—"}
            </span>
          </div>
          <p className="mt-2 text-[11px] text-slate-400">
            As of {new Date(quote.fetchedAt).toLocaleString("en-IN")} — not real-time streaming, refreshed on
            search.
          </p>
        </div>
      )}

      {!quote && !error && !loading && symbol && (
        <p className="mt-3 text-xs text-slate-400">No result for {symbol}.</p>
      )}
    </div>
  );
}
