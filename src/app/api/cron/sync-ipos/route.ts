import { NextResponse } from "next/server";
import { createIpo, findIpoByName, updateIpo } from "@/lib/repositories/ipos";
import { mergeScrapedIntoExisting, syncIposFromSources, type SyncSource } from "@/lib/scraper";
import { logAudit } from "@/lib/repositories/auditLog";

function defaultSources(): SyncSource[] {
  const raw = process.env.IPO_SYNC_SOURCES ?? "";
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((entry) => {
      const [url, type] = entry.split("|");
      return { url: url.trim(), type: (type?.trim() === "SME" ? "SME" : "Mainboard") as SyncSource["type"] };
    });
}

function isAuthorizedCronRequest(req: Request): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  const authHeader = req.headers.get("authorization");
  if (authHeader === `Bearer ${expected}`) return true;
  const url = new URL(req.url);
  return url.searchParams.get("secret") === expected;
}

/**
 * Target for Vercel Cron (see vercel.json) or any external scheduler
 * (cron-job.org, GitHub Actions, etc.) to trigger the daily IPO data sync.
 * Requires CRON_SECRET as a bearer token or ?secret= query param.
 */
export async function GET(req: Request) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sources = defaultSources();
  if (sources.length === 0) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      message: "No IPO_SYNC_SOURCES configured; nothing to sync.",
    });
  }

  try {
    const { ipos: scraped, errors } = await syncIposFromSources(sources);
    let created = 0;
    let updated = 0;
    for (const item of scraped) {
      if (!item.name) continue;
      const existing = await findIpoByName(item.name);
      const patch = mergeScrapedIntoExisting(item, existing);
      if (existing) {
        await updateIpo(existing.id, patch);
        updated++;
      } else {
        await createIpo(patch);
        created++;
      }
    }
    await logAudit("system-cron", "sync", "IPO", "cron-sync", JSON.stringify({ created, updated, errors }));

    return NextResponse.json({ ok: true, created, updated, errors });
  } catch (err) {
    console.error("Cron IPO sync failed:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  return GET(req);
}
