"use client";

import { useState } from "react";
import { Search, ExternalLink } from "lucide-react";

/**
 * Live share price — NOT server-side scraping. src/lib/stockQuote.ts (NSE's
 * quote-equity endpoint) hit a confirmed, unambiguous Akamai bot-management
 * "Access Denied" block — not a header/cookie issue fixable by more
 * guessing, and the same class of protection would very plausibly block
 * any other site's live-price API too (financial data feeds are exactly
 * what this kind of protection exists for). Instead of another blind
 * attempt, this opens Google's own search results for the symbol — Google
 * fetches its own data and is never going to block itself, so this is
 * guaranteed to work every time, just as a link rather than an inline
 * widget. Two links (NSE/BSE) since the two exchanges can show slightly
 * different prices for the same stock.
 */
export function LiveShareSearch() {
  const [input, setInput] = useState("");
  const [searched, setSearched] = useState<string | null>(null);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) return;
    setSearched(trimmed);
  }

  function googleSearchUrl(query: string): string {
    return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
  }

  return (
    <div className="card">
      <h3 className="mb-1 text-sm font-semibold text-slate-700 dark:text-slate-200">Live Share Price</h3>
      <p className="mb-3 text-xs text-slate-400">
        Opens Google&apos;s own live price for the stock — reliable since it&apos;s Google fetching its own data,
        not this site scraping the exchange.
      </p>
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
          <input
            className="input pl-9"
            placeholder="Company or symbol — e.g. TCS, Infosys, Reliance"
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
        </div>
        <button type="submit" className="btn-primary shrink-0" disabled={!input.trim()}>
          Search
        </button>
      </form>

      {searched && (
        <div className="mt-3 flex flex-wrap gap-2">
          <a
            href={googleSearchUrl(`${searched} share price NSE`)}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary flex items-center gap-1.5 text-sm"
          >
            <ExternalLink size={14} /> {searched} on NSE
          </a>
          <a
            href={googleSearchUrl(`${searched} share price BSE`)}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary flex items-center gap-1.5 text-sm"
          >
            <ExternalLink size={14} /> {searched} on BSE
          </a>
        </div>
      )}
    </div>
  );
}
