import type { ApplicationRow } from "@/types";

/**
 * SEBI-style safeguard: flags when the same PAN is used for more than one
 * application within the same IPO (regulators reject duplicate retail
 * applications and both get rejected).
 */
export function findDuplicatePanWarnings(
  applications: ApplicationRow[]
): { ipoId: string; ipoName: string; pan: string; applicationIds: string[] }[] {
  const groups = new Map<string, ApplicationRow[]>();
  for (const a of applications) {
    if (!a.panMasked) continue;
    const key = `${a.ipoId}::${a.panMasked}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(a);
  }
  const warnings: { ipoId: string; ipoName: string; pan: string; applicationIds: string[] }[] = [];
  for (const [, apps] of groups) {
    if (apps.length > 1) {
      warnings.push({
        ipoId: apps[0].ipoId,
        ipoName: apps[0].ipoName,
        pan: apps[0].panMasked,
        applicationIds: apps.map((a) => a.id),
      });
    }
  }
  return warnings;
}
