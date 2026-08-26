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
  updateIpo,
} from "@/lib/repositories/ipos";
import { nseProvider } from "@/lib/ipoProviders/nseProvider";
import type { IpoDataProvider, NormalizedIpo } from "@/lib/ipoProviders/types";
import type { IpoDataSource, IpoRow } from "@/types";

const PROVIDERS: IpoDataProvider[] = [nseProvider];

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

function combineDataSource(existing: IpoDataSource | undefined, providerIsOfficial: boolean): IpoDataSource {
  const incoming: IpoDataSource = providerIsOfficial ? "NSE" : "Manual";
  if (!existing || existing === incoming) return incoming;
  return "NSE + Manual";
}

/** Merges one provider's normalized row into an existing DB row (if any) — never overwrites a field the provider didn't supply, never overwrites a manually-corrected value with a blank. */
async function applyNormalizedIpo(
  item: NormalizedIpo,
  provider: IpoDataProvider
): Promise<"inserted" | "updated" | "skipped"> {
  if (!isValid(item)) return "skipped";

  const id = generateIpoId(item.name, item.type);
  const existing = await getIpo(id);
  const now = new Date().toISOString();

  const patch: Partial<IpoRow> = {
    name: item.name,
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
    dataSource: combineDataSource(existing?.dataSource, provider.isOfficial),
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
