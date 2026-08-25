# Data Schema (browser localStorage)

There is no database. Each list below is one `localStorage` key in the
browser (see [`src/lib/localStorage.ts`](../src/lib/localStorage.ts)),
holding a JSON array of objects shaped exactly like the corresponding
TypeScript type in [`src/types/index.ts`](../src/types/index.ts) — that file
is the single source of truth; keep this doc in sync with it.

Key prefix: `ipo-fund-dashboard:` (e.g. the IPOs list is stored under
`ipo-fund-dashboard:ipos`). You can inspect/edit it yourself in any browser's
DevTools → Application/Storage → Local Storage.

---

## `ipo-fund-dashboard:ipos` → `IpoRow[]` — Module A

| Field | Notes |
|---|---|
| id | `ipo_xxxxxxxx` |
| name | |
| type | `Mainboard` \| `SME` |
| openDate, closeDate, allotmentDate, refundDate, listingDate | ISO `yyyy-MM-dd` |
| priceBandMin, priceBandMax | ₹ |
| lotSize | shares |
| issueSize | free text, e.g. "₹450 Cr" |
| status | `Upcoming` \| `Open` \| `Closed` \| `Allotment Awaited` \| `Allotted` \| `Listed` |
| gmp | ₹ per share — manual or best-effort synced Grey Market Premium |
| gmpUpdatedAt | ISO timestamp |
| listingPrice | number \| `null` — filled once actually listed |
| exchange | e.g. "NSE / BSE" |
| sourceUrl, lastSyncedAt, notes | |

## `ipo-fund-dashboard:applications` → `ApplicationRow[]` — Module B

| Field | Notes |
|---|---|
| id | `app_xxxxxxxx` |
| ipoId, ipoName | references an `IpoRow` |
| appliedInNameOf | Demat account holder label |
| investorId | references an `InvestorRow` |
| panMasked, applicationNumber, upiId | |
| category | `Retail` \| `HNI (sHNI)` \| `bHNI` \| `Shareholder` \| `Employee` |
| lotsApplied, amountBlocked | |
| paymentMode | `ASBA` \| `UPI` |
| allotmentStatus | `Pending` \| `Allotted` \| `Not Allotted` \| `Partial` |
| lotsAllotted, amountAllotted | |
| refundAmount, refundStatus, refundDate | |
| sellDate, sellPrice | once shares are sold post-listing |
| createdBy, createdAt, updatedAt, notes | |

## `ipo-fund-dashboard:funds` → `FundAllocationRow[]` — Module C

| Field | Notes |
|---|---|
| id | `fund_xxxxxxxx` |
| applicationId | references an `ApplicationRow` |
| ipoName | denormalized |
| investorId, investorName | who the capital came from |
| source | `Self` \| `Third-Party` |
| amountContributed, dateReceived | |
| repaymentBankAccount, amountRepaid, repaymentDate | |
| profitShareAmount, profitShareStatus | `N/A` \| `Pending` \| `Settled` |
| createdAt, notes | |

## `ipo-fund-dashboard:investors` → `InvestorRow[]` — Investor Master

| Field | Notes |
|---|---|
| id | `inv_xxxxxxxx` |
| name, relationship | e.g. Self / Spouse / Parent / Client / Friend |
| phone, email | |
| defaultBankAccount, defaultBankIfsc, demandAccountNumber, panMasked | |
| status | `Active` \| `Inactive` |
| createdAt, notes | |
