# IPO Fund Dashboard

A private, multi-user IPO tracking and multi-account fund allocation
dashboard. Next.js 14 (App Router) + TypeScript + Tailwind CSS on the
frontend, Google Sheets as the database, Google Sign-In gated by an
allowlist you control for access.

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
- **Access control** — Google Sign-In restricted to an allowlist you manage
  in-app (Settings → Access), with `viewer` / `editor` / `admin` roles, plus
  a full audit log of every change.
- **Excel export** and a **Google Apps Script** automation alternative.

## Quick start

```bash
npm install
cp .env.example .env.local   # fill in the values — see docs/GOOGLE_SHEETS_SETUP.md
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). You'll be redirected to
sign in with Google; the account(s) listed in `BOOTSTRAP_ADMIN_EMAILS` always
get admin access, so start there.

## Documentation

| Doc | What's in it |
|---|---|
| [`docs/GOOGLE_SHEETS_SETUP.md`](docs/GOOGLE_SHEETS_SETUP.md) | Step-by-step: Google Cloud project, service account, OAuth client, sharing the Sheet, granting access to people |
| [`docs/SCHEMA.md`](docs/SCHEMA.md) | Exact column structure of every sheet tab |
| [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) | Deploying to Vercel, cron setup, custom domain, backups |
| [`scripts/apps-script/Code.gs`](scripts/apps-script/Code.gs) | Alternative/companion automated IPO fetch that runs from Google Apps Script |

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
      settings/        # Access control + audit log (admin only)
    login/, access-denied/
    api/               # REST-ish route handlers, one per resource
  components/          # Reusable UI (AppShell, Modal, MetricCard, ...)
  lib/
    googleSheets.ts     # generic Sheets read/write/cache primitives
    sheetSchemas.ts      # single source of truth for tab names + headers
    repositories/         # typed CRUD per entity, built on googleSheets.ts
    auth.ts, apiAuth.ts     # NextAuth config + API route guard
    calculations.ts          # dashboard/ledger/profit math
    scraper.ts                # best-effort automated IPO data fetch
  types/                # shared TypeScript types
```

## Tech decisions & why

- **Google Sheets as the DB** — zero hosting cost, you already trust it with
  your data, trivially inspectable/editable outside the app, built-in version
  history for backups.
- **Google Sign-In + an in-app allowlist** (not a public sign-up flow) —
  "give permission to whoever I choose" was a core requirement; the
  `Access_Control` tab is the single source of truth for who gets in.
- **Roles (viewer/editor/admin)** — a spouse or CA can view everything without
  risk of accidentally deleting a row; only you (or whoever you promote)
  manages access and deletions.
- **IPO data sync is best-effort by design** — no free, stable public API for
  Indian IPO data exists. The scraper is a heuristic table parser (see
  `src/lib/scraper.ts` for the full reasoning) meant to save typing, not to be
  blindly trusted — always eyeball GMP/dates. Manual entry and JSON bulk
  import always work regardless of scraper health.

## A few things you probably want but might not have thought to ask for

Already built in, beyond the original spec:

- **Role-based access control** with an in-app allowlist and audit log — the
  actual mechanism for "share with people I choose."
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
