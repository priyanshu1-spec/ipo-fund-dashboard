// ============================================================================
// Core domain types, shared between server (API routes, sheet mapping) and
// client (React components). Keep these in sync with docs/SCHEMA.md.
// ============================================================================

export type UserRole = "editor" | "viewer";

export type IpoType = "Mainboard" | "SME";

export type IpoStatus =
  | "Upcoming"
  | "Open"
  | "Closed"
  | "Allotment Awaited"
  | "Allotted"
  | "Listed";

export interface IpoRow {
  id: string;
  name: string;
  type: IpoType;
  openDate: string; // ISO yyyy-MM-dd
  closeDate: string;
  allotmentDate: string;
  refundDate: string;
  listingDate: string;
  priceBandMin: number;
  priceBandMax: number;
  lotSize: number;
  issueSize: string;
  status: IpoStatus;
  gmp: number; // grey market premium, per share, manual or scraped
  gmpUpdatedAt: string;
  listingPrice: number | null; // filled once listed
  exchange: string; // NSE / BSE / NSE SME / BSE SME
  sourceUrl: string;
  lastSyncedAt: string;
  notes?: string;
}

export type ApplicationCategory =
  | "Retail"
  | "HNI (sHNI)"
  | "bHNI"
  | "Shareholder"
  | "Employee";

export type AllotmentStatus = "Pending" | "Allotted" | "Not Allotted" | "Partial";

export interface ApplicationRow {
  id: string;
  ipoId: string;
  ipoName: string;
  appliedInNameOf: string; // Demat account holder, e.g. Self / Spouse / Client A
  investorId: string; // links to InvestorRow — who the Demat/bank belongs to
  panMasked: string; // e.g. ABCDE1234F stored, displayed masked in UI
  applicationNumber: string;
  upiId: string;
  category: ApplicationCategory;
  lotsApplied: number;
  amountBlocked: number;
  paymentMode: "ASBA" | "UPI";
  allotmentStatus: AllotmentStatus;
  lotsAllotted: number;
  amountAllotted: number;
  refundAmount: number;
  refundStatus: "N/A" | "Pending" | "Received";
  refundDate: string;
  sellDate: string;
  sellPrice: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  notes?: string;
}

export type CapitalSource = "Self" | "Third-Party";

export interface FundAllocationRow {
  id: string;
  applicationId: string;
  ipoName: string;
  investorId: string;
  investorName: string;
  source: CapitalSource;
  amountContributed: number;
  dateReceived: string;
  repaymentBankAccount: string;
  amountRepaid: number;
  repaymentDate: string;
  profitShareAmount: number;
  profitShareStatus: "N/A" | "Pending" | "Settled";
  createdAt: string;
  notes?: string;
}

export interface InvestorRow {
  id: string;
  name: string;
  relationship: string; // Self / Spouse / Parent / Client / Friend etc.
  phone: string;
  email: string;
  defaultBankAccount: string;
  defaultBankIfsc: string;
  demandAccountNumber: string;
  panMasked: string;
  status: "Active" | "Inactive";
  createdAt: string;
  notes?: string;
}

export interface AuditLogRow {
  id: string;
  timestamp: string;
  /** Who did it — since access is a shared password rather than individual accounts, this is a role label (e.g. "editor", "system-cron"), not a person's identity. */
  actor: string;
  action: string;
  entityType: string;
  entityId: string;
  details: string;
}

// ---- Derived / computed view models ---------------------------------------

export interface InvestorLedgerSummary {
  investorId: string;
  investorName: string;
  totalProvided: number;
  totalBlocked: number;
  totalRefunded: number;
  totalAllotmentValue: number;
  totalRepaid: number;
  netProfitShare: number;
  outstandingToRepay: number;
}

export interface DashboardSummary {
  totalActiveBids: number;
  totalBlockedCapital: number;
  totalSelfCapital: number;
  totalThirdPartyCapital: number;
  pendingAllotments: number;
  estimatedProfitFromGmp: number;
  upcomingIpoCount: number;
  openIpoCount: number;
  investorLedgers: InvestorLedgerSummary[];
  monthlyPnl: { month: string; profit: number }[];
}
