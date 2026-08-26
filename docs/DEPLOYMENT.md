# Deployment Guide (Vercel — free)

## 1. Push this repo to GitHub (or GitLab/Bitbucket)

Vercel deploys from a git repo.

## 2. Import into Vercel

1. [vercel.com/new](https://vercel.com/new) — sign up free, import this repo.
2. Framework preset: **Next.js**. Keep the **Hobby** plan — free forever,
   covers everything here including one daily Cron job.
3. Before the first deploy, add these Environment Variables (Production
   **and** Preview):

   | Variable | Value |
   |---|---|
   | `APP_ACCESS_PASSWORD` | pick a password — full access |
   | `APP_VIEWER_PASSWORD` | optional — read-only password |
   | `NEXTAUTH_SECRET` | generate with `openssl rand -base64 32` |
   | `NEXTAUTH_URL` | leave blank for now — fill in after step 4 |
   | `CRON_SECRET` | any long random string |

4. Click **Deploy**. You'll get a URL like `your-project.vercel.app`.
5. Set `NEXTAUTH_URL` to that exact URL, then **redeploy** (Deployments →
   ⋯ → Redeploy).

## 3. Connect the database

1. In your project, **Storage** tab → **Create Database** → **Postgres** →
   free plan → **Connect Project** (this project, Production).
2. That's it — Vercel injects `POSTGRES_URL` automatically, which the app
   reads if `DATABASE_URL` isn't explicitly set. Tables are created
   automatically the first time the app runs — no migration step.
3. Prefer a different free provider (Neon, Supabase)? Set `DATABASE_URL`
   yourself instead — either works, see `.env.example`.

## 4. Sign in

Open your URL → enter your `APP_ACCESS_PASSWORD`.

## 5. Automated IPO data fetching

**How it works**: a server-side provider (currently NSE's public
upcoming-issues data) is fetched on a schedule and merged into the
database — the browser is never involved in fetching, only in displaying
what's already there and triggering an on-demand refresh.

- **Scheduled**: `vercel.json` defines a daily Cron job hitting
  `/api/cron/sync-ipos`. Vercel automatically sends
  `Authorization: Bearer $CRON_SECRET` for its own cron triggers once that
  env var is set — no extra wiring.
  - **Frequency limitation, stated plainly**: Vercel's free Hobby plan caps
    Cron Jobs at once per day. Truer "several times a day" automatic
    refreshing (e.g. for open-IPO subscription figures) needs either Vercel
    Pro (paid, allows higher-frequency cron) or an external scheduler
    (cron-job.org, GitHub Actions on a schedule) hitting the same endpoint —
    happy to wire either up if wanted. In the meantime, the admin "Refresh
    IPO Data" button covers on-demand updates between scheduled runs.
- **Manual**: `/ipos` page → **Refresh IPO Data** button (editor role only).
  Shows records found/added/updated and any provider errors immediately.

**What's realistically automatable, stated plainly**: NSE's public
(unofficial but access-restriction-free) endpoint supplies official facts —
dates, price band, lot size, subscription figures once open. **GMP has no
official source from anyone, ever** — it's inherently unofficial grey-market
data, and every value shown is labeled that way in the UI. See
`src/lib/ipoProviders/nseProvider.ts` for the full reasoning and exactly
what is/isn't attempted.

## 6. Custom domain (optional)

**Project Settings → Domains** → add your domain, update `NEXTAUTH_URL`,
redeploy.

## 7. Backups

**Export to Excel** (sidebar) downloads a full snapshot from the database.
Your Postgres provider (Neon/Supabase/Vercel Postgres) also keeps its own
automatic backups on the free tier.

## Known residual `npm audit` findings

Advisories against Next.js itself (edge cases this app doesn't use) and
`xlsx` (only ever used to *write* exports, never to parse untrusted input)
don't apply to how this app actually uses them.
