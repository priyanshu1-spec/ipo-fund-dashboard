import { NextResponse } from "next/server";
import { isAuthedContext, requireApiAuth } from "@/lib/apiAuth";
import { runIpoSync } from "@/lib/ipoSync";

/**
 * Belt-and-suspenders alongside ipoSync.ts's own per-provider hard timeout
 * (35s): guarantees Vercel itself kills this function well inside its
 * platform ceiling rather than a hung upstream connection dragging the
 * request out to minutes before some gateway eventually 504s it — that's
 * what a user actually hit. Set to 60 — the actual maximum Vercel's Hobby
 * plan allows (confirmed; a higher value fails to deploy on Hobby, it
 * isn't silently capped) — for maximum headroom while ipoSync.ts's new
 * per-provider timing breakdown (see the "timing: fetch=...ms
 * write=...ms" note in every fetch-log entry) gathers real evidence on
 * whether 45s was actually enough or the write stage (many DB round
 * trips — db.ts opens a fresh Postgres connection per query) was the
 * real bottleneck once external fetches were already bounded.
 */
export const maxDuration = 60;

/**
 * "Refresh IPO Data" button — admin-only. This writes to the shared/global
 * IPO table every user sees, same reasoning as api/ipos/route.ts: an
 * editor's own data is scoped to themselves everywhere else in the app, so
 * letting an editor trigger a sync that changes what every other user sees
 * would be the one inconsistent hole in that isolation. The browser calls
 * this; the server does the actual fetching. The browser never talks to
 * NSE/BSE directly for this.
 */
export async function POST() {
  const auth = await requireApiAuth("admin");
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
