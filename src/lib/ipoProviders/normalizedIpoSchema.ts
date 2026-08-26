// ============================================================================
// Schema validation for the one boundary that actually matters regardless of
// which provider is active: every provider (NSE's undocumented JSON,
// IPOWatch's scraped HTML tables, a future one) converges on NormalizedIpo
// before ipoSync.ts writes anything to Postgres. Validating there — rather
// than each provider's own raw, unstable upstream shape — protects the
// database from any provider's bug, not just today's.
//
// Every field except name/type/sourceUrl is optional, matching this app's
// core rule (see NormalizedIpo's doc comment): a provider only contributes
// what it actually knows, and a missing/invalid field is dropped (never
// silently coerced to a fabricated 0, empty string, or "TBD") — that's
// exactly the bug fixed earlier when a missing lot size was defaulting to a
// false 0. safeParseNormalizedIpo() below returns the row unless something
// in it is actively wrong (a negative lot size, close date before open
// date, a status/type outside the known enum) — those get dropped with a
// reported reason rather than written to the database malformed.
// ============================================================================

import { z } from "zod";
import type { NormalizedIpo } from "./types";

const ipoTypeSchema = z.enum(["Mainboard", "SME"]);
const ipoStatusSchema = z.enum(["Upcoming", "Open", "Closed", "Allotment Awaited", "Allotted", "Listed"]);
const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "must be an ISO yyyy-MM-dd date");

// A real company name always starts with a letter or digit and never
// contains a currency symbol or a template-placeholder bracket. Added
// after a scraper mismatched a table and inserted "₹[.] Cr." (an unfilled
// template string, not a company) as an IPO name — the length check alone
// didn't catch it, since it's technically >= 2 characters.
const plausibleNameSchema = z
  .string()
  .trim()
  .min(2, "name must be at least 2 characters")
  .refine((s) => /^[A-Za-z0-9]/.test(s), "must start with a letter or digit")
  .refine((s) => !/[₹\[\]{}]/.test(s), "must not contain a currency symbol or template bracket");

export const normalizedIpoSchema = z
  .object({
    name: plausibleNameSchema,
    symbol: z.string().optional(),
    type: ipoTypeSchema,
    issueType: z.string().optional(),
    openDate: isoDateSchema.optional(),
    closeDate: isoDateSchema.optional(),
    allotmentDate: isoDateSchema.optional(),
    listingDate: isoDateSchema.optional(),
    priceBandMin: z.number().nonnegative().optional(),
    priceBandMax: z.number().nonnegative().optional(),
    faceValue: z.number().nonnegative().optional(),
    lotSize: z.number().positive().optional(),
    issueSize: z.string().optional(),
    freshIssueSize: z.string().optional(),
    offerForSaleSize: z.string().optional(),
    status: ipoStatusSchema.optional(),
    registrar: z.string().optional(),
    leadManagers: z.string().optional(),
    qibSubscription: z.number().nonnegative().optional(),
    niiSubscription: z.number().nonnegative().optional(),
    retailSubscription: z.number().nonnegative().optional(),
    employeeSubscription: z.number().nonnegative().optional(),
    shareholderSubscription: z.number().nonnegative().optional(),
    overallSubscription: z.number().nonnegative().optional(),
    gmp: z.number().optional(), // can legitimately go negative in a weak market
    listingPrice: z.number().nonnegative().optional(),
    exchange: z.string().optional(),
    sourceUrl: z.string().min(1),
  })
  .refine((v) => v.priceBandMin == null || v.priceBandMax == null || v.priceBandMin <= v.priceBandMax, {
    message: "priceBandMin must not exceed priceBandMax",
    path: ["priceBandMin"],
  })
  .refine((v) => v.openDate == null || v.closeDate == null || v.openDate <= v.closeDate, {
    message: "openDate must not be after closeDate",
    path: ["openDate"],
  });

export interface ValidationOutcome {
  valid: NormalizedIpo[];
  /** One entry per rejected row: which IPO (by whatever name it had) and why, meant to be surfaced directly in the fetch-log warning. */
  rejections: { name: string; reason: string }[];
}

/** Validates every item a provider returned, splitting into rows safe to write and rejected ones with a reason — never throws, so one bad row from a provider never aborts the rest of that provider's results. */
export function validateNormalizedIpos(items: NormalizedIpo[]): ValidationOutcome {
  const valid: NormalizedIpo[] = [];
  const rejections: ValidationOutcome["rejections"] = [];
  for (const item of items) {
    const result = normalizedIpoSchema.safeParse(item);
    if (result.success) {
      valid.push(result.data);
    } else {
      rejections.push({
        name: item?.name || "(unnamed row)",
        reason: result.error.issues.map((i) => `${i.path.join(".") || "value"}: ${i.message}`).join("; "),
      });
    }
  }
  return { valid, rejections };
}
