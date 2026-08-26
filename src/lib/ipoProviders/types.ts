import type { IpoDataSource, IpoStatus, IpoType } from "@/types";

/**
 * What one provider can contribute for one IPO. All fields optional except
 * name+type (needed to resolve the stable id) — a provider only fills in
 * what it actually knows; everything else stays untouched on the existing
 * row (see mergeNormalizedIntoExisting in ipoSync.ts). Never invent values.
 */
export interface NormalizedIpo {
  name: string;
  symbol?: string;
  type: IpoType;
  issueType?: string;
  openDate?: string;
  closeDate?: string;
  allotmentDate?: string;
  listingDate?: string;
  priceBandMin?: number;
  priceBandMax?: number;
  faceValue?: number;
  lotSize?: number;
  issueSize?: string;
  freshIssueSize?: string;
  offerForSaleSize?: string;
  status?: IpoStatus;
  registrar?: string;
  leadManagers?: string;
  qibSubscription?: number;
  niiSubscription?: number;
  retailSubscription?: number;
  employeeSubscription?: number;
  shareholderSubscription?: number;
  overallSubscription?: number;
  /** Grey market premium — a provider MAY supply this, but it is always treated as unofficial regardless of the provider's own isOfficial flag (see ipoSync.ts). */
  gmp?: number;
  listingPrice?: number;
  exchange?: string;
  sourceUrl: string;
}

export interface ProviderFetchResult {
  ipos: NormalizedIpo[];
  /** Non-fatal issues (e.g. one row on the source page didn't parse) — the whole fetch isn't a failure just because of these. */
  warnings: string[];
}

export interface IpoDataProvider {
  /** Stable key used in ipo_sources / ipo_fetch_logs — keep this constant once chosen. */
  key: string;
  displayName: string;
  /** Whether this provider's core facts (dates/price band/etc.) count as official exchange data. GMP is excluded from this regardless of the value here — see ipoSync.ts. */
  isOfficial: boolean;
  fetch(): Promise<ProviderFetchResult>;
}

export const DATA_SOURCE_LABELS: Record<string, IpoDataSource> = {
  nse: "NSE",
  manual: "Manual",
};
