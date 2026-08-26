import { NextResponse } from "next/server";
import { isAuthedContext, requireApiAuth } from "@/lib/apiAuth";
import { runIpoSync } from "@/lib/ipoSync";

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
