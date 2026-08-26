import { NextResponse } from "next/server";
import { runIpoSync } from "@/lib/ipoSync";

function isAuthorizedCronRequest(req: Request): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  const authHeader = req.headers.get("authorization");
  if (authHeader === `Bearer ${expected}`) return true;
  const url = new URL(req.url);
  return url.searchParams.get("secret") === expected;
}

/**
 * Target for Vercel Cron (see vercel.json) or any external scheduler. The
 * browser is never responsible for this — it runs entirely server-side on a
 * timer. Requires CRON_SECRET as a bearer token or ?secret= query param.
 *
 * Frequency note: Vercel's free Hobby plan limits cron jobs to once per day.
 * Sections of this app that would ideally refresh more often (open-IPO
 * subscription figures) are also covered by the in-app "Refresh IPO Data"
 * admin button for on-demand updates between scheduled runs, or by
 * upgrading to Vercel Pro for higher-frequency cron.
 */
export async function GET(req: Request) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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

export async function POST(req: Request) {
  return GET(req);
}
