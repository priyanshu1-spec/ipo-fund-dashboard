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
  "Refresh IPO Data" button, with manual add/edit always available. Every
  row is labeled by data source (NSE vs Manual vs both), and GMP is always
  clearly marked unofficial/market-indicative since no legitimate source for
  it exists anywhere.
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
  GMP-based estimated profit, monthly realised P&L, duplicate-PAN warnings.
- **Data source health & fetch logs** (Settings page) — see whether NSE
  fetching is currently working, and the history of every sync attempt.
- **Excel export** — full server-side backup on demand.
- **Real per-person accounts with strict data isolation** — sign up at
  `/register`, an admin approves and assigns a role (viewer/editor/admin)
  from the `/admin` panel. Every `viewer`/`editor` only ever sees, edits, or
  deletes their **own** Applications/Funds/Investors — enforced in SQL on
  every query, never just hidden in the UI. Only `admin` sees everyone's
  data. Suspending, deleting, or re-roling an account takes effect on that
  user's very next request, not whenever their session token expires. The
  original shared password(s) still work too, as a bootstrap/recovery path
  (grants `admin`).
- **Admin panel** — approve/reject signups, manage roles, disable or
  permanently delete accounts, see each user's last-active time, and a
  real-time activity log of every create/update/delete across IPOs,
  applications, funds, and investors.

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

**Active providers: NSE + IPOPremium** (`src/lib/ipoProviders/nseProvider.ts`,
`ipopremiumProvider.ts`). Two earlier attempts at a second source were tried
and pulled after confirmed failures — not speculation:

- `chittorgarhProvider.ts`: its report pages are rendered client-side by
  JavaScript, which a plain server-side fetch can never execute (confirmed:
  its raw HTML contains zero `<table>` elements).
- `ipowatchProvider.ts`: its homepage-crawl-to-any-IPO-looking-link
  approach inserted a garbage row (a template placeholder string mistaken
  for a company name) and contributed to a real "Refresh IPO Data" click
  taking minutes before timing out.

`ipopremiumProvider.ts` is deliberately narrower than ipowatch's crawl —
it only ever fetches the fixed homepage URL, never follows a link to a
guessed subpage, specifically to avoid repeating that failure mode. A
secondary provider's rows are fuzzy-matched onto the row NSE already
created (never letting its own spelling of a company name overwrite
NSE's), and every row's `SOURCE` badge shows exactly which provider(s)
contributed. Whatever no active provider publishes stays fillable via
"Add IPO" / manual edit — always available regardless of what's automated;
see `normalizedIpoSchema.ts` for the validation layer (rejects, among
other things, any "name" that isn't a plausible company name — added
after the ipowatch incident) that every provider's output passes through
before it ever reaches the database, whichever provider is active.

**Refresh reliability**: `runIpoSync()` (`src/lib/ipoSync.ts`) wraps every
provider's `fetch()` in a hard 35-second timeout independent of that
provider's own internal timeouts, and both the "Refresh IPO Data" route and
the Cron route set `maxDuration = 45` — so a hung upstream connection now
fails fast and cleanly (one provider marked "failing," others unaffected)
instead of dragging the whole request out to minutes before some gateway
eventually 504s it.

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
    ipoProviders/              # pluggable data source interface — NSE + IPOPremium active; Chittorgarh/IPOWatch disabled, see README
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
