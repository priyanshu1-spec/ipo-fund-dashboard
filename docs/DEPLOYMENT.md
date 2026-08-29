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
   | `APP_ACCESS_PASSWORD` | pick a password — grants the **admin** role (full access + user management) |
   | `APP_VIEWER_PASSWORD` | optional — read-only password |
   | `NEXTAUTH_SECRET` | generate with `openssl rand -base64 32` |
   | `NEXTAUTH_URL` | leave blank for now — fill in after step 4 |
   | `CRON_SECRET` | any long random string |
   | `RESEND_API_KEY` | optional but recommended — powers the self-service "forgot password" email; see §8 below |

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
   - **Using Supabase**: use the **Connection Pooler** string (Project →
     Connect → "Transaction" / "Session" pooler, port `6543` or `5432` on a
     `*.pooler.supabase.com` host), not the "Direct connection" string
     (`db.<ref>.supabase.co`). The direct host frequently fails to resolve
     from serverless platforms like Vercel — `getaddrinfo ENOTFOUND
     db.<ref>.supabase.co` at deploy/runtime is that exact issue. The pooler
     host is built for this and resolves fine.

## 4. Sign in

Open your URL → leave the email field blank → enter your `APP_ACCESS_PASSWORD`.
This signs you in as admin.

To bring in real users: send them your URL's `/register` page. Each
sign-up lands as a **pending** request — approve it (and set its role)
from the **Admin** page in the sidebar, which only shows for the admin
role. The shared password(s) above keep working alongside real accounts —
that's what gets you in to approve the very first one.

**Data isolation, stated plainly**: each `viewer`/`editor` account only
ever sees its own Applications/Funds/Investors entries — not a shared team
view. Only `admin` sees everyone's. If you already had data in this app
before setting up real accounts, that data is tagged `owner_id = 'admin'`
and stays fully visible/editable to any admin, but won't show up for a
newly-approved editor/viewer until it's reassigned or they re-enter it
under their own account.

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

## 8. Forgot-password email (optional but recommended)

Without this, "forgot password" still has two working paths (the admin
resets anyone's password from `/admin`, and the shared password is always
a login itself, not something to reset) — but the self-service "email me a
code" flow at `/forgot-password` needs it configured, and returns a clear
error rather than silently doing nothing if it isn't.

1. Sign up free at [resend.com](https://resend.com) (no credit card;
   100 emails/day, 3,000/month on the free tier).
2. Dashboard → **API Keys** → create one → copy it.
3. Set `RESEND_API_KEY` to that value in Vercel's Environment Variables,
   redeploy.
4. That's it — codes send immediately from Resend's own
   `onboarding@resend.dev` address, no domain setup required. If you want
   mail to appear to come from your own domain instead, verify it under
   Resend's **Domains** tab, then set `RESEND_FROM_EMAIL` to
   `"Your App <noreply@yourdomain.com>"` and redeploy.

## Known residual `npm audit` findings

Advisories against Next.js itself (edge cases this app doesn't use) and
`xlsx` (only ever used to *write* exports, never to parse untrusted input)
don't apply to how this app actually uses them.
