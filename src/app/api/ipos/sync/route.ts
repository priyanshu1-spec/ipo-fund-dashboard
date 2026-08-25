import { NextResponse } from "next/server";
import { isAuthedContext, requireApiAuth } from "@/lib/apiAuth";
import { createIpo, findIpoByName, updateIpo } from "@/lib/repositories/ipos";
import {
  importIposFromJson,
  mergeScrapedIntoExisting,
  syncIposFromSources,
  type ScrapedIpo,
  type SyncSource,
} from "@/lib/scraper";
import { logAudit } from "@/lib/repositories/auditLog";

/** Reads IPO_SYNC_SOURCES env var, format: "url1|Mainboard,url2|SME" */
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

async function applyScrapedIpos(scraped: ScrapedIpo[], actorEmail: string) {
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
      const ipo = await createIpo(patch);
      await logAudit(actorEmail, "create", "IPO", ipo.id, `auto-synced: ${ipo.name}`);
      created++;
    }
  }
  return { created, updated };
}

/**
 * Manual/on-demand sync trigger from the UI ("Sync Now" button on /ipos).
 * Body may optionally include:
 *   { sources: [{url, type}] }  — override the default IPO_SYNC_SOURCES list
 *   { jsonImport: "..." }       — bulk-import a pasted JSON array instead of scraping
 */
export async function POST(req: Request) {
  const auth = await requireApiAuth("editor");
  if (!isAuthedContext(auth)) return auth;

  const body = await req.json().catch(() => ({}));

  if (typeof body.jsonImport === "string" && body.jsonImport.trim()) {
    try {
      const scraped = importIposFromJson(body.jsonImport);
      const result = await applyScrapedIpos(scraped, auth.email);
      await logAudit(auth.email, "sync", "IPO", "bulk-import", JSON.stringify(result));
      return NextResponse.json({ ...result, source: "manual-import", errors: [] });
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Invalid JSON import" },
        { status: 400 }
      );
    }
  }

  const sources: SyncSource[] = Array.isArray(body.sources) && body.sources.length
    ? body.sources
    : defaultSources();

  if (sources.length === 0) {
    return NextResponse.json(
      {
        error:
          "No sync sources configured. Set IPO_SYNC_SOURCES in your environment, or use " +
          "'Bulk Import JSON' to paste IPO data manually. See docs/GOOGLE_SHEETS_SETUP.md.",
      },
      { status: 400 }
    );
  }

  const { ipos: scraped, errors } = await syncIposFromSources(sources);
  const result = await applyScrapedIpos(scraped, auth.email);
  await logAudit(auth.email, "sync", "IPO", "auto-sync", JSON.stringify({ ...result, errors }));

  return NextResponse.json({ ...result, source: "scrape", errors });
}
