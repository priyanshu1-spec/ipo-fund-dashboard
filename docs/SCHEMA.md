# Database Schema (Vercel Postgres)

Tables are created automatically on first use (see
[`src/lib/db.ts`](../src/lib/db.ts)) — you never run a migration by hand.
This doc exists so you can query the database directly (Vercel dashboard →
Storage → your database → Data/Query tab) with confidence about column
meaning.

All money/quantity columns are `NUMERIC`. All date/timestamp columns are
plain `TEXT` holding ISO strings (`yyyy-MM-dd` for dates, full ISO 8601 for
timestamps) — kept as text rather than native `DATE`/`TIMESTAMP` types so the
app's own formatting/timezone logic stays in one place (`src/lib/utils.ts`)
rather than split between JS and Postgres.

---

## `ipos` — Module A

| Column | Notes |
|---|---|
| id | `ipo_xxxxxxxx` |
| name | |
| type | `Mainboard` \| `SME` |
| open_date, close_date, allotment_date, refund_date, listing_date | |
| price_band_min, price_band_max | ₹ |
| lot_size | shares |
| issue_size | free text, e.g. "₹450 Cr" |
| status | `Upcoming` \| `Open` \| `Closed` \| `Allotment Awaited` \| `Allotted` \| `Listed` |
| gmp | ₹ per share — manual or auto-synced Grey Market Premium |
| gmp_updated_at | |
| listing_price | nullable, filled once actually listed |
| exchange | e.g. "NSE / BSE" |
| source_url | where this row was scraped/imported from |
| last_synced_at | |
| notes | |

## `applications` — Module B

| Column | Notes |
|---|---|
| id | `app_xxxxxxxx` |
| ipo_id | FK → `ipos.id` |
| ipo_name | denormalized for readability |
| applied_in_name_of | Demat account holder label |
| investor_id | FK → `investors.id` |
| pan_masked | PAN of the applicant |
| application_number, upi_id | |
| category | `Retail` \| `HNI (sHNI)` \| `bHNI` \| `Shareholder` \| `Employee` |
| lots_applied, amount_blocked | ASBA/UPI blocked amount |
| payment_mode | `ASBA` \| `UPI` |
| allotment_status | `Pending` \| `Allotted` \| `Not Allotted` \| `Partial` |
| lots_allotted, amount_allotted | |
| refund_amount, refund_status, refund_date | |
| sell_date, sell_price | once shares are sold post-listing |
| created_by | username of whoever logged it |
| created_at, updated_at | |
| notes | |

## `fund_allocations` — Module C

| Column | Notes |
|---|---|
| id | `fund_xxxxxxxx` |
| application_id | FK → `applications.id` |
| ipo_name | denormalized |
| investor_id | FK → `investors.id` — who the capital came from |
| investor_name | denormalized |
| source | `Self` \| `Third-Party` |
| amount_contributed, date_received | |
| repayment_bank_account | where to repay this contributor |
| amount_repaid, repayment_date | |
| profit_share_amount, profit_share_status | `N/A` \| `Pending` \| `Settled` |
| created_at, notes | |

One `applications` row can have **multiple** `fund_allocations` rows — e.g.
one bid part-funded by you and part by a relative.

## `investors` — Module D

| Column | Notes |
|---|---|
| id | `inv_xxxxxxxx` |
| name, relationship | e.g. Self / Spouse / Parent / Client / Friend |
| phone, email | |
| default_bank_account, default_bank_ifsc | used as the default repayment account |
| demand_account_number | Demat account number |
| pan_masked | |
| status | `Active` \| `Inactive` |
| created_at, notes | |

## `users` — access control

Per-person accounts (in addition to the always-working bootstrap admin
credentials set as env vars — see `docs/DEPLOYMENT.md` §5).

| Column | Notes |
|---|---|
| id | `user_xxxxxxxx` |
| username | unique, case-insensitive |
| password_hash | `salt:hash`, scrypt — see `src/lib/password.ts`. Never sent to the client. |
| role | `editor` \| `viewer` |
| status | `active` \| `revoked` |
| created_by, created_at, notes | |

## `audit_log`

Append-only activity trail, written automatically on every create/update/delete.

| Column | Notes |
|---|---|
| id | `log_xxxxxxxx` |
| timestamp | |
| actor | the username that made the change (or `system-cron` for automated syncs, or your bootstrap admin username) |
| action | e.g. `create`, `update`, `delete`, `sync` |
| entity_type | e.g. `IPO`, `Application`, `FundAllocation`, `Investor`, `User` |
| entity_id, details | |
