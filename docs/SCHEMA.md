# Database Schema (Postgres)

Tables are created automatically on first use (see
[`src/lib/db.ts`](../src/lib/db.ts)) — no manual migration step. This doc
mirrors [`src/types/index.ts`](../src/types/index.ts), the source of truth
for what each field means; keep both in sync.

---

## `ipos` — Module A / automated + manual IPO data

| Column | Notes |
|---|---|
| id | **Stable identifier**: `ipo_{slugified-name}_{type}` — see `generateIpoId()` in `repositories/ipos.ts`. Deliberately not just the raw name, and generated the same way regardless of which provider supplies the row, so repeated fetches update the same row instead of creating duplicates. |
| name, symbol | |
| type | `Mainboard` \| `SME` |
| issue_type | e.g. "Book Built" — free text, often unavailable pre-filing |
| open_date, close_date, allotment_date, refund_date, listing_date | ISO `yyyy-MM-dd` |
| price_band_min, price_band_max, face_value, lot_size, min_investment | ₹ |
| issue_size, fresh_issue_size, offer_for_sale_size | free text, e.g. "₹450 Cr" |
| status | `Upcoming` \| `Open` \| `Closed` \| `Allotment Awaited` \| `Allotted` \| `Listed` |
| registrar, lead_managers | |
| qib/nii/retail/employee/shareholder/overall_subscription | times subscribed, nullable — official once NSE publishes it |
| gmp | ₹ per share. **Always unofficial/market-indicative** — no exchange or registrar publishes this, from anyone, ever |
| gmp_updated_at | |
| listing_price, listing_gain_percent | filled once actually listed |
| exchange | e.g. "NSE", "NSE SME" |
| is_official | true only when the *core facts* (not GMP) most recently came from an exchange source |
| data_source | `NSE` \| `Manual` \| `NSE + Manual` |
| source_url, last_synced_at, notes | |

## `ipo_gmp_history` — Section 6, historical GMP

Append-only: a new row every time GMP actually changes, never overwritten.

| Column | Notes |
|---|---|
| id | `gmph_xxxxxxxx` |
| ipo_id | FK → `ipos.id`, cascade delete |
| gmp | ₹ per share |
| recorded_at | ISO timestamp |
| source | which provider supplied this reading |

## `ipo_subscription_history` — Section 6, historical subscription

Append-only snapshot per sync run while an IPO is open.

| Column | Notes |
|---|---|
| id | `subh_xxxxxxxx` |
| ipo_id | FK → `ipos.id`, cascade delete |
| qib, nii, retail, employee, shareholder, overall | nullable |
| recorded_at, source | |

## `ipo_fetch_logs` — Section 16, fetch history

| Column | Notes |
|---|---|
| id | `fl_xxxxxxxx` |
| provider | e.g. "NSE" |
| started_at, completed_at | |
| success | |
| records_found, records_inserted, records_updated | |
| error_message | |

## `ipo_sources` — Section 16, live provider health

One row per provider, upserted after every run.

| Column | Notes |
|---|---|
| provider | primary key, e.g. `nse` |
| status | `healthy` \| `failing` \| `unknown` |
| last_success_at, last_error, last_run_at | |

## `investors`, `applications`, `fund_allocations` — Modules B/C/D, your personal data

Same shape as before (see field-by-field list in `src/types/index.ts`), now
persisted server-side instead of the browser. Each carries an `owner_id`
column (defaulted to `'admin'` for this milestone) so Milestone 2 can scope
data per real user account without another migration.
