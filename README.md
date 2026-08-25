# IPO Fund Dashboard

A private IPO tracking and multi-account fund allocation dashboard. Next.js
14 (App Router) + TypeScript + Tailwind CSS on the frontend, Vercel Postgres
as the database, and a simple shared password for access — everything
deploys and configures from one place (Vercel), free.

## What it does

- **IPO Market Watch** — Mainboard & SME IPOs: dates, price band, lot size,
  status, GMP (manual or auto-synced), with search and filters.
- **Application Ledger** — every bid: which Demat/bank account it was applied
  under, PAN, category (Retail/HNI/bHNI/Shareholder/Employee), lots, amount
  blocked, allotment status, refund tracking.
- **Fund Allocation** — for every application, who actually funded it (you vs.
  a named third-party investor), with repayment and profit-share tracking.
- **Investor Master** — everyone whose money or Demat account is involved,
  with a live ledger (provided / blocked / refunded / allotment value /
  outstanding / profit share) computed on the fly.
- **Dashboard** — active bids, blocked capital (self vs. third-party split),
  pending allotments, GMP-based estimated profit, monthly realised P&L chart,
  duplicate-PAN warnings, upcoming/closing-soon IPOs.
- **Access control** — a shared password (optionally two: full-access and
  read-only), no accounts to create, plus a full audit log of every change.
- **Excel export**.

## Quick start (local dev)

```bash
npm install
vercel link && vercel env pull .env.local   # after connecting Postgres — see docs/DEPLOYMENT.md
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), enter the password you
set as `APP_ACCESS_PASSWORD`.

## Documentation

| Doc | What's in it |
|---|---|
| [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) | Full walkthrough: deploy to Vercel, connect the free Postgres database, set passwords, cron setup, custom domain, backups |
| [`docs/SCHEMA.md`](docs/SCHEMA.md) | Exact table structure |

## Project structure

```
src/
  app/
    (app)/            # authenticated pages, wrapped in the sidebar shell
      page.tsx         # Dashboard
      ipos/            # Module A — IPO Market Watch
      applications/    # Module B — Application Ledger
      funds/           # Module C — Fund Allocation
      investors/       # Investor Master + live ledger
      settings/        # Access info + audit log (full-access tier only)
    login/
    api/               # REST-ish route handlers, one per resource
  components/          # Reusable UI (AppShell, Modal, MetricCard, ...)
  lib/
    db.ts                # Postgres client + auto schema creation
    repositories/         # typed CRUD per entity, built on db.ts
    auth.ts, apiAuth.ts     # NextAuth (shared-password Credentials provider) + API route guard
    calculations.ts          # dashboard/ledger/profit math
    scraper.ts                # best-effort automated IPO data fetch
  types/                # shared TypeScript types
```

## Tech decisions & why

- **Vercel Postgres, not Google Sheets** — this app deliberately trades "your
  data lives in an inspectable spreadsheet" for "zero external consoles,
  everything in one dashboard." If you'd rather have the Sheets-backed
  version (browse/edit data as a normal spreadsheet, Google Sign-In per
  person with roles), that's a straightforward variant to build instead —
  just ask.
- **Shared password, not per-person accounts** — the simplest possible "give
  someone access" model: send a link and a password, done. The trade-off is
  no individual identity or per-person revocation — revoking means rotating
  the password for everyone. That trade was made deliberately for minimum
  setup friction; see `docs/DEPLOYMENT.md` §5.
- **IPO data sync is best-effort by design** — no free, stable public API for
  Indian IPO data exists. The scraper is a heuristic table parser (see
  `src/lib/scraper.ts` for the full reasoning) meant to save typing, not to be
  blindly trusted — always eyeball GMP/dates. Manual entry and JSON bulk
  import always work regardless of scraper health.

## A few things you probably want but might not have thought to ask for

Already built in, beyond the original spec:

- **Two access tiers** (full vs. read-only) so you can hand a CA or spouse a
  view-only link without risking accidental edits.
- **Duplicate-PAN detection** — SEBI rejects multiple retail applications
  under the same PAN for one IPO; the dashboard flags it before it becomes a
  refund headache.
- **GMP-based live profit estimator** per application and portfolio-wide,
  that automatically switches to realised P&L once you record a listing
  price or sell price.
- **"Closing in N days" badges** on open IPOs so you don't miss a bid window.
- **Excel export** of the entire ledger (including the computed investor
  summary) for backups or handing to your CA.
- **Dark/light theme** with persisted preference.
- **Bulk JSON import** for IPO data as a robust fallback when automated
  scraping inevitably breaks on a site redesign.
- **Audit log** of every create/update/delete, even without per-person
  accounts.
