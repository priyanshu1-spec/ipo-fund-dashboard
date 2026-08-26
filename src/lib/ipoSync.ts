// ============================================================================
// Sync orchestrator: Scheduler/Admin-refresh -> Providers -> Validation ->
// Normalization -> Database (with history) -> ipo_fetch_logs / ipo_sources.
//
// One provider failing never stops the others, and never touches existing
// data for IPOs that provider didn't return this run — a provider can only
// add/refresh rows, never delete/blank out what's already there.
// ============================================================================

import { ensureSchema, sql } from "@/lib/db";
import { generateId } from "@/lib/id";
import {
  appendGmpHistory,
  appendSubscriptionHistory,
  createIpo,
  generateIpoId,
  getIpo,
  listIpoIdsAndNames,
  updateIpo,
} from "@/lib/repositories/ipos";
import { nseProvider } from "@/lib/ipoProviders/nseProvider";
import { ipowatchProvider } from "@/lib/ipoProviders/ipowatchProvider";
import type { IpoDataProvider, NormalizedIpo } from "@/lib/ipoProviders/types";
import type { IpoDataSource, IpoRow } from "@/types";

// Order matters only in that NSE (official) typically discovers a company
// first; a later provider's row for the "same" IPO is matched onto it by
// fuzzy name (see resolveIpoId) regardless of which ran first.
//
// chittorgarhProvider.ts is NOT registered here: confirmed (not just
// suspected) to return zero <table> elements in its raw HTML response —
// its report pages are rendered client-side by JavaScript, which a plain
// server-side fetch never executes. That's not a fixable selector/markup
// problem without a headless browser (Puppeteer/Playwright), which is a
// poor fit for a Vercel serverless function. Left in the codebase in case
// a future source turns out to expose the same data via a real HTML
// table or JSON endpoint, but it must stay out of PROVIDERS until then —
// it was only adding latency and a permanent warning for zero rows.
const PROVIDERS: IpoDataProvider[] = [nseProvider, ipowatchProvider];

/** Strip legal-entity noise so "XYZ Ltd" / "XYZ Limited" / "XYZ India Pvt Ltd" compare equal across sources that phrase the same company differently. */
function normalizeCompanyName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(limited|ltd|india|pvt|private|inc)\b\.?/g, "")
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

/**
 * Resolves which DB row a provider's item belongs to. Tries the exact
 * slug-derived id first (fast path — matches when a provider re-reports the
 * same spelling, which is the common case). If that misses, looks for
 * exactly one existing row of the same type whose normalized name matches or
 * contains/[is contained by] the incoming name — this is what lets a
 * secondary source (different exact company-name spelling) supplement an
 * existing row instead of creating a duplicate. Ambiguous (0 or 2+ matches)
 * falls back to the exact-slug id, i.e. its own new row.
 */
async function resolveIpoId(item: NormalizedIpo): Promise<string> {
  const exactId = generateIpoId(item.name, item.type);
  if (await getIpo(exactId)) return exactId;

  const normalizedIncoming = normalizeCompanyName(item.name);
  if (!normalizedIncoming) return exactId;

  const candidates = await listIpoIdsAndNames(item.type);
  const matches = candidates.filter((c) => {
    const normalizedExisting = normalizeCompanyName(c.name);
    if (!normalizedExisting) return false;
    return (
      normalizedExisting === normalizedIncoming ||
      normalizedExisting.includes(normalizedIncoming) ||
      normalizedIncoming.includes(normalizedExisting)
    );
  });
  return matches.length === 1 ? matches[0].id : exactId;
}

export interface ProviderRunSummary {
  provider: string;
  success: boolean;
  recordsFound: number;
  recordsInserted: number;
  recordsUpdated: number;
  error: string;
}

export interface SyncSummary {
  startedAt: string;
  completedAt: string;
  providers: ProviderRunSummary[];
  totalInserted: number;
  totalUpdated: number;
}

/** Basic sanity checks — reject a row that's too broken to be worth storing, without ever inventing values to fill gaps. */
function isValid(item: NormalizedIpo): boolean {
  if (!item.name || item.name.trim().length < 2) return false;
  if (item.priceBandMin != null && item.priceBandMax != null && item.priceBandMin > item.priceBandMax) return false;
  return true;
}

const SOURCE_PRIORITY = ["NSE", "IPOWatch", "Chittorgarh", "Manual"];

/** Adds providerLabel to whatever sources already contributed to this row (order-independent, de-duplicated), rendered in a stable order per SOURCE_PRIORITY — any label not listed there (a new provider added without updating this list) still appears, just after the known ones, rather than silently vanishing. */
function combineDataSource(existing: IpoDataSource | undefined, providerLabel: string): IpoDataSource {
  const tokens = new Set(existing ? existing.split(" + ") : []);
  tokens.add(providerLabel);
  const known = SOURCE_PRIORITY.filter((s) => tokens.has(s));
  const unknown = Array.from(tokens).filter((t) => !SOURCE_PRIORITY.includes(t));
  return [...known, ...unknown].join(" + ");
}

/** Merges one provider's normalized row into an existing DB row (if any) — never overwrites a field the provider didn't supply, never overwrites a manually-corrected value with a blank. */
async function applyNormalizedIpo(
  item: NormalizedIpo,
  provider: IpoDataProvider
): Promise<"inserted" | "updated" | "skipped"> {
  if (!isValid(item)) return "skipped";

  const id = await resolveIpoId(item);
  const existing = await getIpo(id);
  const now = new Date().toISOString();

  const patch: Partial<IpoRow> = {
    // A secondary (non-official) provider matched onto an existing row by
    // fuzzy name never overwrites the name that's already there — its own
    // spelling may differ, and the existing one (usually NSE's) wins.
    name: existing && !provider.isOfficial ? existing.name : item.name,
    type: item.type,
    ...(item.symbol && { symbol: item.symbol }),
    ...(item.issueType && { issueType: item.issueType }),
    ...(item.openDate && { openDate: item.openDate }),
    ...(item.closeDate && { closeDate: item.closeDate }),
    ...(item.allotmentDate && { allotmentDate: item.allotmentDate }),
    ...(item.listingDate && { listingDate: item.listingDate }),
    ...(item.priceBandMin != null && { priceBandMin: item.priceBandMin }),
    ...(item.priceBandMax != null && { priceBandMax: item.priceBandMax }),
    ...(item.faceValue != null && { faceValue: item.faceValue }),
    ...(item.lotSize != null && { lotSize: item.lotSize }),
    ...(item.issueSize && { issueSize: item.issueSize }),
    ...(item.freshIssueSize && { freshIssueSize: item.freshIssueSize }),
    ...(item.offerForSaleSize && { offerForSaleSize: item.offerForSaleSize }),
    ...(item.status && { status: item.status }),
    ...(item.registrar && { registrar: item.registrar }),
    ...(item.leadManagers && { leadManagers: item.leadManagers }),
    ...(item.qibSubscription != null && { qibSubscription: item.qibSubscription }),
    ...(item.niiSubscription != null && { niiSubscription: item.niiSubscription }),
    ...(item.retailSubscription != null && { retailSubscription: item.retailSubscription }),
    ...(item.employeeSubscription != null && { employeeSubscription: item.employeeSubscription }),
    ...(item.shareholderSubscription != null && { shareholderSubscription: item.shareholderSubscription }),
    ...(item.overallSubscription != null && { overallSubscription: item.overallSubscription }),
    ...(item.listingPrice != null && { listingPrice: item.listingPrice }),
    ...(item.exchange && { exchange: item.exchange }),
    isOfficial: provider.isOfficial || existing?.isOfficial || false,
    dataSource: combineDataSource(existing?.dataSource, provider.displayName),
    sourceUrl: item.sourceUrl,
    lastSyncedAt: now,
  };

  // GMP is a special case: always unofficial regardless of provider, and
  // every change is recorded as a history point rather than just overwritten.
  if (item.gmp != null) {
    patch.gmp = item.gmp;
    patch.gmpUpdatedAt = now;
    if (!existing || existing.gmp !== item.gmp) {
      await appendGmpHistory(id, item.gmp, provider.displayName);
    }
  }

  const hasSubscriptionData =
    item.qibSubscription != null ||
    item.niiSubscription != null ||
    item.retailSubscription != null ||
    item.employeeSubscription != null ||
    item.shareholderSubscription != null ||
    item.overallSubscription != null;
  if (hasSubscriptionData) {
    await appendSubscriptionHistory(
      id,
      {
        qib: item.qibSubscription ?? null,
        nii: item.niiSubscription ?? null,
        retail: item.retailSubscription ?? null,
        employee: item.employeeSubscription ?? null,
        shareholder: item.shareholderSubscription ?? null,
        overall: item.overallSubscription ?? null,
      },
      provider.displayName
    );
  }

  if (existing) {
    await updateIpo(id, patch);
    return "updated";
  }
  await createIpo({ ...patch, id });
  return "inserted";
}

async function recordSourceHealth(provider: string, success: boolean, error: string, now: string) {
  await ensureSchema();
  await sql`
    INSERT INTO ipo_sources (provider, status, last_success_at, last_error, last_run_at)
    VALUES (${provider}, ${success ? "healthy" : "failing"}, ${success ? now : ""}, ${error}, ${now})
    ON CONFLICT (provider) DO UPDATE SET
      status = ${success ? "healthy" : "failing"},
      last_success_at = CASE WHEN ${success} THEN ${now} ELSE ipo_sources.last_success_at END,
      last_error = ${error},
      last_run_at = ${now}
  `;
}

async function logFetch(summary: ProviderRunSummary, startedAt: string, completedAt: string) {
  await ensureSchema();
  await sql`
    INSERT INTO ipo_fetch_logs (id, provider, started_at, completed_at, success, records_found, records_inserted, records_updated, error_message)
    VALUES (${generateId("fl")}, ${summary.provider}, ${startedAt}, ${completedAt}, ${summary.success}, ${summary.recordsFound}, ${summary.recordsInserted}, ${summary.recordsUpdated}, ${summary.error})
  `;
}

/** Runs every registered provider once, applying results to the database. Never throws — a provider failure is captured per-provider so the others still run. */
export async function runIpoSync(): Promise<SyncSummary> {
  const startedAt = new Date().toISOString();
  const providerSummaries: ProviderRunSummary[] = [];

  for (const provider of PROVIDERS) {
    const providerStart = new Date().toISOString();
    let inserted = 0;
    let updated = 0;
    let found = 0;
    let error = "";
    let success = true;

    try {
      const result = await provider.fetch();
      found = result.ipos.length;
      for (const item of result.ipos) {
        const outcome = await applyNormalizedIpo(item, provider);
        if (outcome === "inserted") inserted++;
        if (outcome === "updated") updated++;
      }
      if (result.warnings.length > 0 && found === 0) {
        // Zero usable rows is not a hard failure (site may just have nothing
        // new right now) unless there's also nothing else to show for it —
        // still surface the warning as the "error" field for visibility.
        error = result.warnings.join("; ");
      }
    } catch (err) {
      success = false;
      error = err instanceof Error ? err.message : String(err);
    }

    const providerCompleted = new Date().toISOString();
    const summary: ProviderRunSummary = {
      provider: provider.displayName,
      success,
      recordsFound: found,
      recordsInserted: inserted,
      recordsUpdated: updated,
      error,
    };
    providerSummaries.push(summary);
    await logFetch(summary, providerStart, providerCompleted);
    await recordSourceHealth(provider.key, success, error, providerCompleted);
  }

  const completedAt = new Date().toISOString();
  return {
    startedAt,
    completedAt,
    providers: providerSummaries,
    totalInserted: providerSummaries.reduce((s, p) => s + p.recordsInserted, 0),
    totalUpdated: providerSummaries.reduce((s, p) => s + p.recordsUpdated, 0),
  };
}
