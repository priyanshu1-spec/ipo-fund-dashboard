import { NextResponse } from "next/server";
import { isAuthedContext, requireApiAuth } from "@/lib/apiAuth";
import { fetchLiveQuote } from "@/lib/stockQuote";

/** Guarantees Vercel kills this well before an unresponsive upstream could hang it for minutes — same lesson as the IPO sync's earlier 504s. */
export const maxDuration = 30;

export async function GET(req: Request) {
  const auth = await requireApiAuth("viewer");
  if (!isAuthedContext(auth)) return auth;

  const symbol = new URL(req.url).searchParams.get("symbol") ?? "";

  const [nse, bse] = await Promise.all([fetchLiveQuote(symbol, "NSE"), fetchLiveQuote(symbol, "BSE")]);

  if (!nse.ok && !bse.ok) {
    return NextResponse.json({ nseError: nse.error, bseError: bse.error }, { status: 502 });
  }
  return NextResponse.json({
    nse: nse.ok ? nse.quote : null,
    bse: bse.ok ? bse.quote : null,
    nseError: nse.ok ? undefined : nse.error,
    bseError: bse.ok ? undefined : bse.error,
  });
}
