import { NextResponse } from "next/server";
import { isAuthedContext, requireApiAuth } from "@/lib/apiAuth";
import { runIpoSync } from "@/lib/ipoSync";

/**
 * Belt-and-suspenders alongside ipoSync.ts's own per-provider hard timeout
 * (35s): guarantees Vercel itself kills this function well inside its
 * platform ceiling rather than a hung upstream connection dragging the
 * request out to minutes before some gateway eventually 504s it — that's
 * what a user actually hit once. 45s comfortably covers one provider's
 * 35s cap plus DB write time; raise if more providers run concurrently.
 */
export const maxDuration = 45;

/**
 * "Refresh IPO Data" button — editor-only. The browser calls this; the
 * server does the actual fetching. The browser never talks to NSE/BSE
 * directly for this.
 */
export async function POST() {
  const auth = await requireApiAuth("editor");
  if (!isAuthedContext(auth)) return auth;

  try {
    const summary = await runIpoSync();
    return NextResponse.json({ ok: true, ...summary });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
