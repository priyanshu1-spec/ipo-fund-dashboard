# IPO Fund Dashboard

A private IPO tracking and multi-account fund allocation dashboard. Next.js
14 (App Router) + TypeScript + Tailwind CSS, server-side Postgres, and
automated IPO data fetching. Deploys free on Vercel.

**Status**: Milestone 1 of a larger build — server-side database, automated
IPO fetching, scheduler, and admin refresh are done. Real per-person
accounts/approval, an admin panel, and activity/submission tracking are
planned for later milestones (see `docs/DEPLOYMENT.md` and inline comments
in `src/lib/auth.ts` for exactly what's in place today vs. planned).

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

## Automated IPO data fetching — how and what's realistic

`Scheduler → Provider(s) → Validation → Normalization → Database → API → UI`
(see `src/lib/ipoSync.ts`). One provider failing never stops the dashboard —
previously-fetched and manually-entered data stays available regardless.

Being direct about what's actually achievable here: there is no official,
sanctioned public API for Indian IPO data. NSE's public (but undocumented)
endpoint is the most legitimate automatable source for official facts; GMP
is inherently unofficial from every source that publishes it, always. See
`src/lib/ipoProviders/nseProvider.ts` for the full reasoning, and
`docs/DEPLOYMENT.md` §5 for the Cron frequency limitation on Vercel's free
tier.

A second provider, `src/lib/ipoProviders/chittorgarhProvider.ts`
(`isOfficial: false`), supplements whatever NSE doesn't publish yet — lot
size, allotment/listing dates — from chittorgarh.com's public report pages.
It's fuzzy-matched onto the same row NSE already created (never lets its own
spelling of a company name overwrite NSE's), and every row's `SOURCE` badge
tells you exactly which provider(s) contributed to it.

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
    login/
    api/
      ipos/, ipos/upcoming|open|closed, ipos/[id]/history|subscription-history
      applications/, funds/, investors/, dashboard/summary, export
      admin/ipo/refresh|fetch-status|fetch-logs
      cron/sync-ipos    # scheduled entry point (CRON_SECRET-protected)
      auth/              # NextAuth sign-in
  components/          # Reusable UI (AppShell, Modal, MetricCard, ...)
  lib/
    db.ts                 # Postgres client + schema
    repositories/            # typed CRUD + history per entity
    ipoProviders/              # pluggable data source interface + NSE provider
    ipoSync.ts                   # orchestrator: fetch -> validate -> normalize -> store -> log
    auth.ts, apiAuth.ts             # NextAuth + server-side API route guard
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
