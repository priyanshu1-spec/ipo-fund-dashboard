# Google Sheet Schema

The app treats one Google Spreadsheet as its database. Each tab below is
created automatically (with the exact header row shown) the first time the
app writes to it — you never have to create these by hand. This doc exists so
you can read the raw sheet, write your own formulas/pivot tables against it,
or restore from a backup with confidence about column meaning.

The single source of truth for tab names and headers in code is
[`src/lib/sheetSchemas.ts`](../src/lib/sheetSchemas.ts) — if you ever change a
header there, update this file to match.

---

## `IPO_Master_Data` — Module A

| Column | Type | Notes |
|---|---|---|
| id | string | `ipo_xxxxxxxx` |
| name | string | |
| type | `Mainboard` \| `SME` | |
| openDate | date (`yyyy-MM-dd`) | |
| closeDate | date | |
| allotmentDate | date | |
| refundDate | date | |
| listingDate | date | |
| priceBandMin | number (₹) | |
| priceBandMax | number (₹) | |
| lotSize | number (shares) | |
| issueSize | string | free text, e.g. "₹450 Cr" |
| status | `Upcoming` \| `Open` \| `Closed` \| `Allotment Awaited` \| `Allotted` \| `Listed` | |
| gmp | number (₹ per share) | manual or auto-synced Grey Market Premium |
| gmpUpdatedAt | ISO timestamp | |
| listingPrice | number \| blank | filled once actually listed |
| exchange | string | e.g. "NSE / BSE" |
| sourceUrl | string | where this row was scraped/imported from |
| lastSyncedAt | ISO timestamp | |
| notes | string | |

## `Application_Ledger` — Module B

| Column | Type | Notes |
|---|---|---|
| id | string | `app_xxxxxxxx` |
| ipoId | string | FK → `IPO_Master_Data.id` |
| ipoName | string | denormalized for readability |
| appliedInNameOf | string | Demat account holder label |
| investorId | string | FK → `Investor_Master.id` |
| panMasked | string | PAN of the applicant |
| applicationNumber | string | |
| upiId | string | |
| category | `Retail` \| `HNI (sHNI)` \| `bHNI` \| `Shareholder` \| `Employee` | |
| lotsApplied | number | |
| amountBlocked | number (₹) | ASBA/UPI blocked amount |
| paymentMode | `ASBA` \| `UPI` | |
| allotmentStatus | `Pending` \| `Allotted` \| `Not Allotted` \| `Partial` | |
| lotsAllotted | number | |
| amountAllotted | number (₹) | |
| refundAmount | number (₹) | |
| refundStatus | `N/A` \| `Pending` \| `Received` | |
| refundDate | date | |
| sellDate | date | once shares are sold post-listing |
| sellPrice | number (₹ per share) | |
| createdBy | string | email of who logged it |
| createdAt | ISO timestamp | |
| updatedAt | ISO timestamp | |
| notes | string | |

## `Fund_Allocation` — Module C

| Column | Type | Notes |
|---|---|---|
| id | string | `fund_xxxxxxxx` |
| applicationId | string | FK → `Application_Ledger.id` |
| ipoName | string | denormalized |
| investorId | string | FK → `Investor_Master.id` — who the capital came from |
| investorName | string | denormalized |
| source | `Self` \| `Third-Party` | |
| amountContributed | number (₹) | |
| dateReceived | date | |
| repaymentBankAccount | string | where to repay this contributor |
| amountRepaid | number (₹) | |
| repaymentDate | date | |
| profitShareAmount | number (₹) | this investor's share of realised profit |
| profitShareStatus | `N/A` \| `Pending` \| `Settled` | |
| createdAt | ISO timestamp | |
| notes | string | |

One `Application_Ledger` row can have **multiple** `Fund_Allocation` rows —
e.g. one bid part-funded by you and part by a relative.

## `Investor_Master` — Module D

| Column | Type | Notes |
|---|---|---|
| id | string | `inv_xxxxxxxx` |
| name | string | |
| relationship | string | Self / Spouse / Parent / Client / Friend etc. |
| phone | string | |
| email | string | |
| defaultBankAccount | string | used as the default repayment account |
| defaultBankIfsc | string | |
| demandAccountNumber | string | Demat account number |
| panMasked | string | |
| status | `Active` \| `Inactive` | |
| createdAt | ISO timestamp | |
| notes | string | |

## `Access_Control`

Controls who may sign in at all, and their role.

| Column | Type | Notes |
|---|---|---|
| id | string | `acc_xxxxxxxx` |
| email | string | Google account email, lower-cased |
| role | `admin` \| `editor` \| `viewer` | |
| status | `active` \| `revoked` | |
| addedBy | string | email of the admin who granted it |
| addedAt | ISO timestamp | |
| notes | string | |

## `Audit_Log`

Append-only activity trail, written automatically on every create/update/delete.

| Column | Type | Notes |
|---|---|---|
| id | string | `log_xxxxxxxx` |
| timestamp | ISO timestamp | |
| actorEmail | string | |
| action | string | e.g. `create`, `update`, `delete`, `sync`, `grant-access` |
| entityType | string | e.g. `IPO`, `Application`, `FundAllocation`, `Investor`, `Access` |
| entityId | string | |
| details | string | short human-readable summary |
