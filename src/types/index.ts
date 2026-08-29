// ============================================================================
// Core domain types. This app is server-backed by Postgres (see
// src/lib/db.ts and src/lib/repositories/*.ts) — these types describe the
// shape of each table's rows. Keep in sync with docs/SCHEMA.md.
// ============================================================================

export type UserRole = "admin" | "editor" | "viewer";

/** pending: registered, awaiting an admin's approve/reject. disabled: was approved, access later revoked. */
export type UserAccountStatus = "pending" | "approved" | "rejected" | "disabled";

export interface UserAccount {
  id: string;
  email: string;
  /** Optional alternate login handle — "" when not set, sign-in then falls back to email only. */
  username: string;
  /** The question text only, "" when not set — safe to expose (the answer hash is not part of this type, see UserSecurityAuth in repositories/users.ts). */
  securityQuestion: string;
  name: string;
  role: UserRole;
  status: UserAccountStatus;
  createdAt: string;
  approvedAt: string;
  approvedBy: string;
  lastActiveAt: string;
}

export type ActivityAction = "create" | "update" | "delete";

export interface ActivityLogEntry {
  id: string;
  userId: string;
  userName: string;
  action: ActivityAction;
  entityType: string;
  entityId: string;
  entityLabel: string;
  details: string;
  createdAt: string;
}

export type IpoType = "Mainboard" | "SME";

export type IpoStatus =
  | "Upcoming"
  | "Open"
  | "Closed"
  | "Allotment Awaited"
  | "Allotted"
  | "Listed";

/**
 * Who last supplied the core facts for this IPO row — NOT the same as
 * whether GMP is official (GMP is never official, from anyone). A
 * " + "-joined list of every provider display name that has ever
 * contributed to this row (see combineDataSource() in ipoSync.ts), or
 * "Manual". Left as `string` rather than an enumerated union: the set of
 * providers changes over time (see ipoSync.ts's PROVIDERS list), and the
 * combination count grows combinatorially with each one added.
 */
export type IpoDataSource = string;

export interface IpoRow {
  id: string; // stable identifier — see generateIpoId() in repositories/ipos.ts; never re-derive from name alone
  name: string;
  symbol: string;
  type: IpoType;
  issueType: string; // e.g. "Book Built", "Fixed Price" — free text, often unavailable pre-filing
  openDate: string; // ISO yyyy-MM-dd
  closeDate: string;
  allotmentDate: string;
  refundDate: string;
  listingDate: string;
  priceBandMin: number;
  priceBandMax: number;
  faceValue: number | null;
  lotSize: number | null;
  minInvestment: number | null;
  issueSize: string;
  freshIssueSize: string;
  offerForSaleSize: string;
  status: IpoStatus;
  registrar: string;
  leadManagers: string; // comma-separated free text
  qibSubscription: number | null;
  niiSubscription: number | null;
  retailSubscription: number | null;
  employeeSubscription: number | null;
  shareholderSubscription: number | null;
  overallSubscription: number | null;
  gmp: number | null; // grey market premium, per share — ALWAYS unofficial/market-indicative, never from an exchange or registrar
  gmpUpdatedAt: string;
  listingPrice: number | null; // filled once listed
  listingGainPercent: number | null;
  exchange: string; // NSE / BSE / NSE SME / BSE SME
  /** True only when the core facts (dates/price band/lot size/status) came from an official exchange source on the most recent update — GMP itself is excluded from this and always treated as unofficial. */
  isOfficial: boolean;
  dataSource: IpoDataSource;
  sourceUrl: string;
  lastSyncedAt: string;
  notes?: string;
}

export interface GmpHistoryEntry {
  id: string;
  ipoId: string;
  gmp: number;
  recordedAt: string;
  source: string;
}

export interface SubscriptionHistoryEntry {
  id: string;
  ipoId: string;
  qib: number | null;
  nii: number | null;
  retail: number | null;
  employee: number | null;
  shareholder: number | null;
  overall: number | null;
  recordedAt: string;
  source: string;
}

export interface FetchLogEntry {
  id: string;
  provider: string;
  startedAt: string;
  completedAt: string | null;
  success: boolean;
  recordsFound: number;
  recordsInserted: number;
  recordsUpdated: number;
  errorMessage: string;
}

export interface SourceHealth {
  provider: string;
  status: "healthy" | "failing" | "unknown";
  lastSuccessAt: string;
  lastError: string;
  lastRunAt: string;
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
