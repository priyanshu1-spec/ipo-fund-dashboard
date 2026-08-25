// ============================================================================
// Single source of truth for tab names and column headers.
// If you change a header here, update docs/SCHEMA.md to match.
// ============================================================================

export const TABS = {
  IPO_MASTER: "IPO_Master_Data",
  APPLICATIONS: "Application_Ledger",
  FUND_ALLOCATION: "Fund_Allocation",
  INVESTORS: "Investor_Master",
  ACCESS_CONTROL: "Access_Control",
  AUDIT_LOG: "Audit_Log",
} as const;

export const IPO_HEADERS = [
  "id",
  "name",
  "type",
  "openDate",
  "closeDate",
  "allotmentDate",
  "refundDate",
  "listingDate",
  "priceBandMin",
  "priceBandMax",
  "lotSize",
  "issueSize",
  "status",
  "gmp",
  "gmpUpdatedAt",
  "listingPrice",
  "exchange",
  "sourceUrl",
  "lastSyncedAt",
  "notes",
];

export const APPLICATION_HEADERS = [
  "id",
  "ipoId",
  "ipoName",
  "appliedInNameOf",
  "investorId",
  "panMasked",
  "applicationNumber",
  "upiId",
  "category",
  "lotsApplied",
  "amountBlocked",
  "paymentMode",
  "allotmentStatus",
  "lotsAllotted",
  "amountAllotted",
  "refundAmount",
  "refundStatus",
  "refundDate",
  "sellDate",
  "sellPrice",
  "createdBy",
  "createdAt",
  "updatedAt",
  "notes",
];

export const FUND_ALLOCATION_HEADERS = [
  "id",
  "applicationId",
  "ipoName",
  "investorId",
  "investorName",
  "source",
  "amountContributed",
  "dateReceived",
  "repaymentBankAccount",
  "amountRepaid",
  "repaymentDate",
  "profitShareAmount",
  "profitShareStatus",
  "createdAt",
  "notes",
];

export const INVESTOR_HEADERS = [
  "id",
  "name",
  "relationship",
  "phone",
  "email",
  "defaultBankAccount",
  "defaultBankIfsc",
  "demandAccountNumber",
  "panMasked",
  "status",
  "createdAt",
  "notes",
];

export const ACCESS_CONTROL_HEADERS = [
  "id",
  "email",
  "role",
  "status",
  "addedBy",
  "addedAt",
  "notes",
];

export const AUDIT_LOG_HEADERS = [
  "id",
  "timestamp",
  "actorEmail",
  "action",
  "entityType",
  "entityId",
  "details",
];

export const ALL_TABS: { name: string; headers: string[] }[] = [
  { name: TABS.IPO_MASTER, headers: IPO_HEADERS },
  { name: TABS.APPLICATIONS, headers: APPLICATION_HEADERS },
  { name: TABS.FUND_ALLOCATION, headers: FUND_ALLOCATION_HEADERS },
  { name: TABS.INVESTORS, headers: INVESTOR_HEADERS },
  { name: TABS.ACCESS_CONTROL, headers: ACCESS_CONTROL_HEADERS },
  { name: TABS.AUDIT_LOG, headers: AUDIT_LOG_HEADERS },
];
