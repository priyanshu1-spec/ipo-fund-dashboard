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
// "Working day" skips Saturday/Sunday AND any date in the caller-supplied
// holiday set — see repositories/marketHolidays.ts. That table is
// admin-managed and empty by default (this file has no independently
// verifiable source for exact NSE/BSE trading-holiday dates, so it never
// guesses one), so until an admin adds a holiday, estimates spanning one
// can still be off by a day — that's why the UI always labels these
// "estimated", never as NSE-confirmed.
//
// HONEST CAVEAT, deliberately not glossed over: restricted to Mainboard
// IPOs only. SME issues have historically followed a different, less
// consistently-documented timeline, and this file's confidence there
// isn't high enough to compute a number and label it "estimated" the same
// way — better to show nothing than a guess dressed up as informed.
// ============================================================================

import type { IpoType } from "@/types";

function addWorkingDays(date: Date, days: number, holidayDates: ReadonlySet<string>): Date {
  const result = new Date(date);
  let remaining = days;
  while (remaining > 0) {
    result.setDate(result.getDate() + 1);
    const day = result.getDay(); // 0 = Sunday, 6 = Saturday
    if (day !== 0 && day !== 6 && !holidayDates.has(toIsoDate(result))) remaining--;
  }
  return result;
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Returns an estimated ISO date, or null when there's nothing to estimate from (no close date yet) or this isn't a type this file is confident estimating for (SME). `holidayDates` is optional — omit it (or pass an empty set) to skip only weekends, same as before market holidays were tracked. */
export function estimateAllotmentDate(closeDate: string, type: IpoType, holidayDates: ReadonlySet<string> = new Set()): string | null {
  if (type !== "Mainboard" || !closeDate) return null;
  const parsed = new Date(closeDate);
  if (isNaN(parsed.getTime())) return null;
  return toIsoDate(addWorkingDays(parsed, 1, holidayDates));
}

export function estimateListingDate(closeDate: string, type: IpoType, holidayDates: ReadonlySet<string> = new Set()): string | null {
  if (type !== "Mainboard" || !closeDate) return null;
  const parsed = new Date(closeDate);
  if (isNaN(parsed.getTime())) return null;
  return toIsoDate(addWorkingDays(parsed, 3, holidayDates));
}
