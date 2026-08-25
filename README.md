# IPO Fund Dashboard

A private IPO tracking and multi-account fund allocation dashboard. Next.js
14 (App Router) + TypeScript + Tailwind CSS. **No backend database** — all
data lives in the browser's `localStorage`, and access is a simple shared
password. Deploys free on Vercel with nothing else to sign up for.

## What it does

- **IPO Market Watch** — Mainboard & SME IPOs: dates, price band, lot size,
  status, GMP (manual or best-effort client-side synced), with search and
  filters.
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
- **Excel export** — your actual backup, since there's no server-side copy.

## Important: no database means no shared/multi-device data

This is a deliberate trade-off, not an oversight. Because there's no backend
storage, **every browser/device has its own independent copy of the data.**
If you open the dashboard on your phone and your laptop, you'll see two
different, unconnected datasets. If you share the link and password with
someone else, they get their own empty dashboard, not a shared view of
yours. If that's not what you want, a database-backed version (with real
shared, multi-device data) is a different architecture — ask if you'd
rather have that instead.

## Quick start

```bash
npm install
cp .env.example .env.local   # fill in a password — see docs/DEPLOYMENT.md
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), enter the password you
set as `APP_ACCESS_PASSWORD`.

## Documentation

| Doc | What's in it |
|---|---|
| [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) | Deploying to Vercel (no database step at all), passwords, custom domain, backups |
| [`docs/SCHEMA.md`](docs/SCHEMA.md) | Exact localStorage key/shape for every entity |

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
      settings/        # How storage/access works
    login/
    api/auth/          # the only backend route — NextAuth sign-in
  components/          # Reusable UI (AppShell, Modal, MetricCard, ...)
  lib/
    localStorage.ts       # the entire data layer — typed localStorage CRUD
    fallbackIpos.ts         # sample rows shown before you've added real ones
    clientIpoSync.ts          # best-effort client-side IPO fetch (CORS proxy)
    xlsxExport.ts               # client-side Excel export/backup
    calculations.ts               # dashboard/ledger/profit math (pure, reusable)
    duplicatePan.ts                 # SEBI duplicate-PAN warning check
    auth.ts                          # NextAuth password-only Credentials provider
  types/                # shared TypeScript types — the schema, in effect
```

## Tech decisions & why

- **No backend, no database** — the simplest possible thing to deploy: push
  code, set two or three passwords, done. The trade-off, stated plainly
  above, is no shared/multi-device data. That trade was made explicitly at
  your request.
- **Shared password, not per-person accounts** — with no database, there's
  nowhere to store individual accounts either; access is one (or two)
  passwords set as environment variables.
- **IPO data sync is client-side and best-effort by design** — a browser
  can't fetch arbitrary external sites directly (CORS), so "Sync Now" routes
  through a free public proxy and parses whatever HTML comes back. This is
  meaningfully less reliable than a server-side fetch, on top of the
  underlying reality that no free, stable, official source of Indian IPO GMP
  data exists at all. See `src/lib/clientIpoSync.ts`. Manual entry and JSON
  bulk import always work regardless.
