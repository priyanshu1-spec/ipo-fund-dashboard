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

## `investors`, `applications`, `fund_allocations` — Modules B/C/D, per-user data

Same shape as before (see field-by-field list in `src/types/index.ts`), now
persisted server-side instead of the browser. Each row carries an
`owner_id` — the id of the user who created it — and every query is
scoped to it: a `viewer`/`editor` only ever sees, edits, or deletes their
**own** rows, enforced in SQL on every statement (`WHERE owner_id = ...`,
see `scopeFor()` in `src/lib/apiAuth.ts` and every function in
`src/lib/repositories/{applications,funds,investors}.ts`) — never left as
an app-layer-only check a route could forget. `admin` is the one role that
bypasses this and sees/touches every row, unscoped, which is what the
Admin panel's global view relies on.

This app has no per-request Postgres role to hang a native `CREATE POLICY`
off (see `src/lib/db.ts` — one shared connection, not a Supabase-style
per-user session), so this is the practical equivalent of Postgres RLS for
this architecture: identical isolation guarantee, enforced in the
repository layer instead of the database layer.

**Data created before this model existed** carries the literal string
`'admin'` as its `owner_id`, which doesn't match any real user id — it's
still fully visible and editable by any `admin`, just invisible to
`editor`/`viewer` accounts unless reassigned.

## `users` — Milestone 2, real per-person accounts

| Column | Notes |
|---|---|
| id | `user_xxxxxxxx` |
| email | unique, case-insensitive |
| username | optional, unique when set (case-insensitive, partial index so blank never collides) — an alternate sign-in handle alongside email, set at registration or later from My Account |
| password_hash | bcrypt |
| name | |
| role | `viewer` \| `editor` \| `admin` — set by an admin, defaults to `viewer` at signup |
| status | `pending` \| `approved` \| `rejected` \| `disabled` — only `approved` can sign in |
| created_at, approved_at, approved_by | |
| last_active_at | stamped on every authenticated API request (see below) |
| reset_otp_hash, reset_otp_expires_at, reset_otp_attempts | forgot-password OTP (bcrypt-hashed, 10-minute expiry, 5-attempt cap) — see `src/app/api/auth/{forgot-password,reset-password}/route.ts` |

Sign-up (`/register`) always creates a `pending` row with role `viewer`; an
admin changes status/role from `/admin`. The original Milestone 1 shared
passwords (`APP_ACCESS_PASSWORD` → role `admin`, `APP_VIEWER_PASSWORD` →
role `viewer`) still work as a bootstrap/recovery path and don't touch this
table at all — see `src/lib/auth.ts`.

**Revocation is instant, not "whenever the token expires."** A NextAuth JWT
session is otherwise stateless — normally, suspending or deleting a user
wouldn't take effect until their token naturally expired. Instead,
`requireApiAuth()` (`src/lib/apiAuth.ts`) re-checks this table's live
status on *every single API request* for a real account (`UPDATE users SET
last_active_at = now() WHERE id = ... RETURNING *`, one round trip) — if an
admin suspended, rejected, or deleted the account, or changed its role,
that's what the user hits on their very next click, and it's also what
stamps `last_active_at` for the Admin panel's "Last Active" column.
Deleting a user (Admin panel → Delete) removes the row entirely but leaves
their Applications/Funds/Investors data untouched (see above) — it becomes
admin-only visible, not lost.

## `activity_log` — Milestone 2, audit trail

Append-only. One row per create/update/delete made through the API (IPOs,
applications, funds, investors, and user approval/role changes).

| Column | Notes |
|---|---|
| id | `act_xxxxxxxx` |
| user_id, user_name | who did it (real user id, or the fixed `bootstrap-admin`/`bootstrap-viewer` id for the shared-password path) |
| action | `create` \| `update` \| `delete` |
| entity_type | `ipo` \| `application` \| `fund` \| `investor` \| `user` |
| entity_id, entity_label | |
| details, created_at | |
