import { NextResponse } from "next/server";
import { isAuthedContext, requireApiAuth } from "@/lib/apiAuth";
import { fetchLiveQuote, resolveQuery } from "@/lib/stockQuote";

/** Guarantees Vercel kills this well before an unresponsive upstream could hang it for minutes — same lesson as the IPO sync's earlier 504s. */
export const maxDuration = 30;

export async function GET(req: Request) {
  const auth = await requireApiAuth("viewer");
  if (!isAuthedContext(auth)) return auth;

  const query = new URL(req.url).searchParams.get("symbol") ?? "";

  // Resolves a company name ("Tata Consultancy Services") or a partial/
  // loosely-cased symbol to the exact bare ticker Yahoo's chart API needs.
  // Falls back to the raw query itself if resolution finds nothing (or
  // that step fails outright) — keeps an exact-ticker search working even
  // if this new lookup breaks.
  const resolved = await resolveQuery(query);
  const symbol = resolved?.symbol ?? query;

  const [nse, bse] = await Promise.all([fetchLiveQuote(symbol, "NSE"), fetchLiveQuote(symbol, "BSE")]);

  if (!nse.ok && !bse.ok) {
    return NextResponse.json({ nseError: nse.error, bseError: bse.error }, { status: 502 });
  }
  return NextResponse.json({
    resolvedName: resolved?.name,
    nse: nse.ok ? nse.quote : null,
    bse: bse.ok ? bse.quote : null,
    nseError: nse.ok ? undefined : nse.error,
    bseError: bse.ok ? undefined : bse.error,
  });
}
