import type { IpoRow } from "@/types";

/**
 * Shown the first time someone opens IPO Market Watch on a fresh browser
 * (before they've synced or added anything real) so the page isn't empty.
 * These are clearly-labeled SAMPLE rows, not real market data — delete or
 * edit them freely. Real data comes from "Sync Now" (best-effort, see
 * clientIpoSync.ts) or from typing it in yourself via "Add IPO".
 */
export function buildFallbackIpos(): IpoRow[] {
  const now = new Date().toISOString();
  const base: Omit<IpoRow, "id"> = {
    name: "",
    type: "Mainboard",
    openDate: "",
    closeDate: "",
    allotmentDate: "",
    refundDate: "",
    listingDate: "",
    priceBandMin: 0,
    priceBandMax: 0,
    lotSize: 0,
    issueSize: "",
    status: "Upcoming",
    gmp: 0,
    gmpUpdatedAt: now,
    listingPrice: null,
    exchange: "",
    sourceUrl: "sample-data",
    lastSyncedAt: now,
    notes: "Sample row — edit the details or delete it once you have real IPOs to track.",
  };

  const rows: Array<Partial<IpoRow>> = [
    {
      name: "Sample Mainboard IPO Ltd (edit me)",
      type: "Mainboard",
      openDate: "",
      closeDate: "",
      priceBandMin: 100,
      priceBandMax: 110,
      lotSize: 130,
      issueSize: "₹500 Cr",
      status: "Upcoming",
      gmp: 15,
      exchange: "NSE / BSE",
    },
    {
      name: "Sample SME IPO Pvt Ltd (edit me)",
      type: "SME",
      openDate: "",
      closeDate: "",
      priceBandMin: 45,
      priceBandMax: 48,
      lotSize: 3000,
      issueSize: "₹25 Cr",
      status: "Upcoming",
      gmp: 8,
      exchange: "NSE SME / BSE SME",
    },
  ];

  return rows.map((r, i) => ({
    ...base,
    ...r,
    id: `sample_${i}`,
  })) as IpoRow[];
}
