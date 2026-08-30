// ============================================================================
// Estimated allotment/listing dates, computed from the close date — used
// only when NSE hasn't published an actual date yet (or ever will for a
// given row) and manual entry hasn't filled it in either.
//
// This is NOT a guess pulled from thin air: SEBI mandated a standardized
// T+3 listing timeline for mainboard IPOs (in effect since December 2023)
// — Day 0 is the issue closing date, the basis of allotment is finalized
// and refunds/demat credit initiated on T+1, and listing happens on T+3.
// That's a regulatory rule, not a scraped or fabricated number, which is
// why this is safe to compute rather than another "try a different
// unofficial source" attempt (the kind that already failed for
// Chittorgarh/IPOWatch/IPOPremium — see README).
//
// HONEST CAVEATS, deliberately not glossed over:
// - "Working day" here only skips Saturday/Sunday — it does NOT account
//   for NSE/BSE trading holidays, so an estimate spanning a market holiday
//   can be off by a day. Labeled as an estimate in the UI specifically
//   because of this — never presented as if it were NSE-confirmed.
// - Restricted to Mainboard IPOs only. SME issues have historically
//   followed a different, less consistently-documented timeline, and this
//   file's confidence there isn't high enough to compute a number and
//   label it "estimated" the same way — better to show nothing than a
//   guess dressed up as informed.
// ============================================================================

import type { IpoType } from "@/types";

function addWorkingDays(date: Date, days: number): Date {
  const result = new Date(date);
  let remaining = days;
  while (remaining > 0) {
    result.setDate(result.getDate() + 1);
    const day = result.getDay(); // 0 = Sunday, 6 = Saturday
    if (day !== 0 && day !== 6) remaining--;
  }
  return result;
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Returns an estimated ISO date, or null when there's nothing to estimate from (no close date yet) or this isn't a type this file is confident estimating for (SME). */
export function estimateAllotmentDate(closeDate: string, type: IpoType): string | null {
  if (type !== "Mainboard" || !closeDate) return null;
  const parsed = new Date(closeDate);
  if (isNaN(parsed.getTime())) return null;
  return toIsoDate(addWorkingDays(parsed, 1));
}

export function estimateListingDate(closeDate: string, type: IpoType): string | null {
  if (type !== "Mainboard" || !closeDate) return null;
  const parsed = new Date(closeDate);
  if (isNaN(parsed.getTime())) return null;
  return toIsoDate(addWorkingDays(parsed, 3));
}
