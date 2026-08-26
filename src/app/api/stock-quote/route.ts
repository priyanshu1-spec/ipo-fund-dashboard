import { NextResponse } from "next/server";
import { isAuthedContext, requireApiAuth } from "@/lib/apiAuth";
import { fetchLiveQuote } from "@/lib/stockQuote";

/** Guarantees Vercel kills this well before nseindia.com could ever hang it for minutes — same lesson learned from the IPO sync's earlier 504s. */
export const maxDuration = 30;

export async function GET(req: Request) {
  const auth = await requireApiAuth("viewer");
  if (!isAuthedContext(auth)) return auth;

  const symbol = new URL(req.url).searchParams.get("symbol") ?? "";
  const result = await fetchLiveQuote(symbol);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }
  return NextResponse.json({ quote: result.quote });
}
