# IPO Fund Dashboard

A private IPO tracking and multi-account fund allocation dashboard. Next.js
14 (App Router) + TypeScript + Tailwind CSS, server-side Postgres, and
automated IPO data fetching. Deploys free on Vercel.

**Status**: Milestones 1 and 2 done. Server-side database, automated IPO
fetching, scheduler, and admin refresh (Milestone 1); real per-person
accounts with admin approval, role management, and an activity/submission
audit log (Milestone 2) — see `docs/DEPLOYMENT.md` and inline comments in
`src/lib/auth.ts` for exactly how access works today.

## What it does

- **IPO Market Watch** — Mainboard & SME IPOs: dates, price band, lot size,
  registrar, subscription figures, status, and GMP — automatically fetched
  server-side (NSE) on a daily schedule plus on-demand via an admin
  "Refresh IPO Data" button, with manual add/edit always available. This
  data is shared/global — the same rows for every user, unlike the
  per-user modules below — so adding, editing, deleting, or refreshing it
  is **admin-only**, not editor: an editor's own writes are scoped to
  themselves everywhere else in the app, and IPOs would be the one hole in
  that isolation if an editor could change what every other user sees.
  Every user (viewer, editor, admin) can still view this list. Every row
  is labeled by data source (NSE vs Manual vs both), and GMP is always
  clearly marked unofficial/market-indicative since no legitimate source for
  it exists anywhere. Once an IPO closes, an icon next to its Allotment
  date links straight to that IPO's **registrar** (KFin, Link Intime,
  Bigshare, etc. — allotment is always checked on the registrar's site,
  never NSE/BSE) for a small set of well-known registrars this app
  recognizes by name (`src/lib/allotmentLinks.ts`); an unrecognized or
  missing registrar falls back to a pre-filled Google search instead of a
  dead link, so this always gets you *somewhere* useful. When NSE hasn't
  published an allotment/listing date yet (and no one has entered one
  manually), the dashboard shows an **estimated** one instead of leaving it
  blank — computed from SEBI's standardized T+3 mainboard listing timeline
  (close date → allotment T+1 working day → listing T+3), a regulatory
  rule, not another scrape (`src/lib/ipoTimeline.ts`). Always shown in
  italics with "(est.)" and a tooltip explaining it's an estimate, doesn't
  account for market holidays, and is Mainboard-only (SME's timeline isn't
  consistent enough to estimate confidently) — never silently blended in
  as if it were NSE-confirmed.
- **GMP history** — every change is recorded, viewable per-IPO, not just
  overwritten.
- **Application Ledger** — every bid: which Demat/bank account it was applied
  under, PAN, category, lots, amount blocked, allotment status, refund
  tracking.
- **Fund Allocation** — who actually funded each application (you vs. a
  named third-party investor), with repayment and profit-share tracking.
- **Investor Master** — everyone whose money or Demat account is involved,
  with a live ledger computed on the fly.
- **Dashboard** — active bids, blocked capital split, pending allotments,
  GMP-based estimated profit, monthly realised P&L, duplicate-PAN warnings,
  and a **live share price search** (`src/components/LiveShareSearch.tsx`
  / `src/lib/stockQuote.ts`) — inline NSE and BSE prices for any searched
  symbol *or company name*, via Yahoo Finance's chart and search APIs
  (`query1.finance.yahoo.com`). A free-text query ("Tata Consultancy
  Services") is resolved to a bare NSE/BSE ticker first via Yahoo's own
  search/autocomplete endpoint (`resolveQuery()`), filtered to equities on
  India's two exchanges; an exact ticker keeps working unchanged if that
  resolution step finds nothing. Once shown, the price re-fetches every 15
  seconds on its own (`POLL_INTERVAL_MS` in `LiveShareSearch.tsx`) so the
  number visibly moves rather than sitting on one static snapshot — a
  deliberate poll, not a tick-by-tick stream, since true real-time push
  needs a broker API (Kite Connect, Upstox, etc.) this app doesn't have; a
  failed background poll keeps the last-good price on screen rather than
  blanking it. Two earlier sources were ruled out first: NSE's own
  quote-equity endpoint hit a confirmed Akamai bot-management block (a real
  "Access Denied" page, not a header/cookie issue — live per-stock quotes
  are exactly the kind of data an exchange protects hardest, unlike its IPO
  calendar), and scraping Google's search results was ruled out outright
  — against Google's Terms of Service and this app's own "never bypass a
  CAPTCHA/rate-limit/access control" principle. Yahoo's endpoints are plain
  JSON APIs long-used by the open-source finance community for exactly
  this, not search-results pages. If a symbol can't be found on either
  exchange, the search falls back to a Google search link instead of
  failing silently.
- **Data source health & fetch logs** (Settings page) — see whether NSE
  fetching is currently working, and the history of every sync attempt.
- **Excel export** — full server-side backup on demand.
- **Real per-person accounts with strict data isolation** — sign up at
  `/register`, an admin approves and assigns a role (viewer/editor/admin)
  from the `/admin` panel. Sign-in accepts either your email **or** an
  optional username (set at registration or later from My Account) — the
  login page's one field tells them apart by whether it contains an "@".
  Every `viewer`/`editor` only ever sees, edits, or
  deletes their **own** Applications/Funds/Investors — enforced in SQL on
  every query, never just hidden in the UI. Only `admin` sees everyone's
  data. Suspending, deleting, or re-roling an account takes effect on that
  user's very next request, not whenever their session token expires. The
  original shared password(s) still work too, as a bootstrap/recovery path
  (grants `admin`).
- **Admin panel** — approve/reject signups, manage roles, disable or
  permanently delete accounts, **reset any user's forgotten password**
  directly (no email involved — the admin sets a new one and relays it to
  the user out of band), see each user's last-active time, and a real-time
  activity log of every create/update/delete across IPOs, applications,
  funds, and investors. **Every approved admin is emailed when a new
  signup requests approval** (see `docs/DEPLOYMENT.md` §9 for the one-time
  `RESEND_API_KEY` setup) — best-effort and non-blocking, so a signup still
  succeeds even if the notification email fails or isn't configured; you'd
  just need to check `/admin` yourself in that case.
- **My Account** (`/account`) — every signed-in user (any role) can see
  their own name, email, role, status, and last-active time; edit their
  own display name; and change their own password (current password
  required).
- **Forgot password** (`/forgot-password`) — self-service, for a real
  registered account only (not the shared password), via a security
  question: set one at `/register` (optional, skippable) or later from My
  Account, then answer it to set a new password — no email service, no
  extra setup, works immediately. The answer is bcrypt-hashed at rest,
  never stored in plain text, and matched case/whitespace-insensitively so
  a forgotten capitalization doesn't lock you out of your own recovery
  path. Known, accepted trade-off: unlike a one-time emailed code, the
  question itself has to be shown to whoever attempts a reset for that
  email — there's no way to gate the challenge behind proving identity
  first, since answering it *is* the identity proof — and there's no
  expiry or attempt limit on guessing the answer (a security question
  doesn't naturally expire the way a code does). Reasonable for a small
  private deployment; if you can't sign in at all and never set a
  question, an admin resets your password for you from the Admin panel
  above, and the shared bootstrap password remains the ultimate recovery
  path for the admin themselves if their own account is ever locked out.
  The shared bootstrap login(s) have no personal name/password to manage
  here (nothing is stored in the database for them) — optionally set
  `APP_ACCESS_NAME` / `APP_VIEWER_NAME` in Vercel to give them a display
  name of your choosing instead of the generic default. A display-name
  change (real account or env var) only shows up after signing out and
  back in — same session-token reason role changes need a fresh login,
  see RBAC note below.

## Automated IPO data fetching — how and what's realistic

`Scheduler → Provider(s) → Validation → Normalization → Database → API → UI`
(see `src/lib/ipoSync.ts`). One provider failing never stops the dashboard —
previously-fetched and manually-entered data stays available regardless.

**The dashboard never fetches from an external source on page load** —
`GET /api/ipos` is a plain Postgres read (`src/app/api/ipos/route.ts`), full
stop. External fetching happens in exactly two places, both already off any
visitor's request path: the daily Vercel Cron (`vercel.json` →
`/api/cron/sync-ipos`) and the admin-only "Refresh IPO Data" button. That's
the local-cache-plus-background-refresh pattern this kind of app should
have, already in place — see `docs/DEPLOYMENT.md` §5 if you want
higher-than-daily refresh (Vercel's Hobby plan caps Cron at once/day; an
external scheduler like cron-job.org or GitHub Actions hitting the same
endpoint gets around that without upgrading).

**Validation, concretely**: every provider — regardless of how unstructured
or undocumented its upstream source is — converges on one `NormalizedIpo`
shape before anything reaches Postgres, and every single row is checked
against `src/lib/ipoProviders/normalizedIpoSchema.ts` (a Zod schema) right
there in `ipoSync.ts`. A row that fails (bad enum, close date before open
date, a negative lot size) is dropped with a specific, logged reason
(visible in the fetch-log warning) — never silently written malformed, and
never fabricated into a plausible-looking placeholder (a missing field
stays missing, shown as "—" in the UI, not coerced to `0` or `"TBD"` — the
opposite of that once caused a real bug: a missing lot size defaulting to a
false `0`).

Being direct about what's actually achievable here: there is no official,
sanctioned public API for Indian IPO data. NSE's public (but undocumented)
endpoint is the most legitimate automatable source for official facts; GMP
is inherently unofficial from every source that publishes it, always. See
`src/lib/ipoProviders/nseProvider.ts` for the full reasoning, and
`docs/DEPLOYMENT.md` §5 for the Cron frequency limitation on Vercel's free
tier.

**NSE is the only active provider** (`src/lib/ipoProviders/nseProvider.ts`).
Three attempts at a second source were tried and pulled after confirmed
failures — not speculation:

- `chittorgarhProvider.ts`: its report pages are rendered client-side by
  JavaScript, which a plain server-side fetch can never execute (confirmed:
  its raw HTML contains zero `<table>` elements).
- `ipowatchProvider.ts`: its homepage-crawl-to-any-IPO-looking-link
  approach inserted a garbage row (a template placeholder string mistaken
  for a company name) and contributed to a real "Refresh IPO Data" click
  taking minutes before timing out.
- `ipopremiumProvider.ts`: HTTP 403 on every request — actively blocked,
  not just unreachable.

All three files are left in the codebase as a starting point for a future,
properly-scoped fix — or a genuine documented API, if one ever surfaces.
If a secondary source is ever re-enabled, its rows are fuzzy-matched onto
the row NSE already created (never letting its own spelling of a company
name overwrite NSE's), and every row's `SOURCE` badge shows exactly which
provider(s) contributed. Whatever NSE doesn't publish (lot size especially
— confirmed absent from NSE's response entirely, not a parsing bug) stays
fillable via "Add IPO" / manual edit — always available regardless of
what's automated. See `normalizedIpoSchema.ts` for the validation layer
(rejects, among other things, any "name" that isn't a plausible company
name — added after the ipowatch incident) every provider's output passes
through before it ever reaches the database.

**Refresh reliability**: `runIpoSync()` (`src/lib/ipoSync.ts`) wraps every
provider's `fetch()` in a hard 35-second timeout independent of that
provider's own internal timeouts, both the "Refresh IPO Data" route and the
Cron route set `maxDuration = 60` (Hobby's actual max), and every sync
sweeps for and removes any leftover row whose name isn't a plausible
company name (e.g. old scraper garbage) before touching anything else.
Schema setup (`ensureSchema()` in `src/lib/db.ts`) also runs as one batched
multi-statement query over a single connection rather than 17 separate
ones — a large, easy-to-miss cost on a cold serverless start.

## Quick start

```bash
npm install
cp .env.example .env.local   # fill in a database URL + password — see docs/DEPLOYMENT.md
npm run dev
```

## Documentation

| Doc | What's in it |
|---|---|
| [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) | Deploying to Vercel, database setup, cron, backups |
| [`docs/SCHEMA.md`](docs/SCHEMA.md) | Exact table structure |

## Project structure

```
src/
  app/
    (app)/            # authenticated pages, sidebar shell
      page.tsx         # Dashboard
      ipos/            # Module A — IPO Market Watch + Refresh IPO Data
      applications/    # Module B — Application Ledger
      funds/           # Module C — Fund Allocation
      investors/       # Investor Master + live ledger
      settings/        # Data source health, fetch logs, access info
      admin/           # user approval/roles + activity log (admin role only)
    login/, register/
    api/
      ipos/, ipos/upcoming|open|closed, ipos/[id]/history|subscription-history
      applications/, funds/, investors/, dashboard/summary, export
      admin/ipo/refresh|fetch-status|fetch-logs
      admin/users, admin/users/[id], admin/activity
      cron/sync-ipos    # scheduled entry point (CRON_SECRET-protected)
      auth/              # NextAuth sign-in + /auth/register
  components/          # Reusable UI (AppShell, Modal, MetricCard, ...)
  lib/
    db.ts                 # Postgres client + schema
    repositories/            # typed CRUD + history per entity, incl. users + activityLog
    ipoProviders/              # pluggable data source interface — only NSE active; Chittorgarh/IPOWatch/IPOPremium disabled, see README
    ipoSync.ts                   # orchestrator: fetch -> validate -> normalize -> store -> log
    auth.ts, apiAuth.ts             # NextAuth (DB users + legacy shared password) + API guard
    calculations.ts                   # dashboard/ledger/profit math
  types/                # shared TypeScript types — the schema, in effect
```

## Tech decisions & why

- **Server-side Postgres, not browser storage** — required for the data to
  survive refresh/restart/redeploy and be automatically updated by a
  scheduler while nobody has the browser open.
- **A pluggable provider architecture, not a hardcoded scraper** — each
  source (`src/lib/ipoProviders/*`) implements the same interface, so a new
  or replacement source can be added without touching the sync logic, the
  database layer, or the UI.
- **Never bypass access controls** — if a source requires defeating a
  CAPTCHA, Cloudflare challenge, login, or rate limit, it's not used. NSE's
  endpoint is used because it's reachable through a normal, restriction-free
  request; if it ever isn't, this app is designed to just show fewer
  auto-updated fields, not to route around whatever blocked it.
- **GMP is architecturally second-class** — a nullable field, always tagged
  unofficial, with its own history table, never merged into "official"
  status fields. This isn't a UI label bolted on after the fact — the
  distinction is enforced in `ipoSync.ts`.
