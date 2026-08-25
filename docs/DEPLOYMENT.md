# Deployment Guide (Vercel — free, no other consoles needed)

Everything this app needs — hosting, the database, and daily automated
sync — is configured inside one place: your Vercel dashboard. No Google
Cloud, no separate database provider signup.

## 1. Push this repo to GitHub (or GitLab/Bitbucket)

Vercel deploys from a git repo.

## 2. Import into Vercel

1. [vercel.com/new](https://vercel.com/new) — sign up free (GitHub login
   works), import this repo.
2. Framework preset: **Next.js** (auto-detected). Keep the **Hobby** plan —
   it's free forever and covers everything this app needs.
3. Before the first deploy, add these Environment Variables under
   **Project Settings → Environment Variables** (Production **and** Preview):

   | Variable | Value |
   |---|---|
   | `APP_ACCESS_PASSWORD` | pick a password — this is what you'll share to give someone full access |
   | `APP_VIEWER_PASSWORD` | optional — a second password for read-only access, or leave unset |
   | `NEXTAUTH_SECRET` | generate with `openssl rand -base64 32` |
   | `NEXTAUTH_URL` | leave blank for now — fill in after step 4 |
   | `CRON_SECRET` | any long random string |
   | `IPO_SYNC_SOURCES` | optional, see `docs/DEPLOYMENT.md` §6 below |

4. Click **Deploy**. You'll get a URL like `your-project.vercel.app`.
5. Go back to Environment Variables, set `NEXTAUTH_URL` to that exact URL
   (e.g. `https://your-project.vercel.app`), then **redeploy** (Deployments
   tab → ⋯ → Redeploy) so it picks up the change.

## 3. Connect the database (Vercel Postgres, free tier)

1. In your project, go to the **Storage** tab → **Create Database** →
   **Postgres** → pick the free plan → **Connect Project** (select this
   project, all environments).
2. That's it — Vercel injects `POSTGRES_URL` and friends into your project's
   env vars automatically. The app creates its own tables the first time it
   runs (see `src/lib/db.ts`) — there's no migration step to run by hand.
3. For local dev, run `vercel link` then `vercel env pull .env.local` in the
   project folder to copy those same values down to your machine.

## 4. Sign in

Open your Vercel URL → enter the password you set as `APP_ACCESS_PASSWORD`.
You're in with full access.

## 5. Share it

Just send people the URL and the password (the viewer password, if you set
one, for anyone who should only look, not edit). That's the entire "give
access" process — no invites, no accounts, no per-person setup.

**To revoke access for everyone at once**: change `APP_ACCESS_PASSWORD` (and/or
`APP_VIEWER_PASSWORD`) in Environment Variables, then redeploy. Every existing
session is invalidated immediately since there's no per-person allowlist to
manage individually — see `docs/SCHEMA.md` and the in-app Settings page for
more on this trade-off.

## 6. Automated daily IPO sync (Vercel Cron)

[`vercel.json`](../vercel.json) already defines a daily cron job hitting
`/api/cron/sync-ipos` at 03:00 UTC. Vercel automatically attaches
`Authorization: Bearer $CRON_SECRET` to requests it triggers for cron jobs
when `CRON_SECRET` is set as an env var on the project — no extra wiring
needed. Cron Jobs are available on the free Hobby tier at this frequency.

Set which pages to scrape via `IPO_SYNC_SOURCES` (comma-separated
`url|Mainboard` / `url|SME` pairs), e.g.:

```
IPO_SYNC_SOURCES=https://example.com/mainboard-ipos|Mainboard,https://example.com/sme-ipos|SME
```

**Read this before relying on it:** [`src/lib/scraper.ts`](../src/lib/scraper.ts)
documents in detail why this is a best-effort heuristic parser, not a
guaranteed integration — public IPO portals don't offer a stable free API and
change their markup without notice. Treat automated sync as a convenience,
verify GMP/dates before applying, and use **Bulk Import JSON** or manual
add/edit on the `/ipos` page as your reliable fallback.

You can also trigger a sync any time from the UI (`/ipos` → **Sync Now**), or
manually hit the cron endpoint yourself:
`curl -H "Authorization: Bearer $CRON_SECRET" https://YOUR-DOMAIN/api/cron/sync-ipos`.

## 7. Custom domain (optional)

**Project Settings → Domains** → add your domain, follow the DNS
instructions, then update `NEXTAUTH_URL` and redeploy.

## 8. Backups

**Export to Excel** (sidebar, or `/api/export`) downloads a full multi-sheet
`.xlsx` snapshot of every table plus the computed investor ledger — useful
for tax filing or an off-platform backup. Vercel Postgres (built on Neon)
also keeps automatic point-in-time backups on its own.

## Known residual `npm audit` findings

`npm audit` will report a handful of advisories against transitive
dependencies (Next.js edge cases around Image Optimizer/i18n/Server Actions
that this app doesn't use, and `xlsx`, which we only ever *write* with, never
parse untrusted input through). None apply to how this app actually uses
them, but if you later add features that touch those code paths (next/image,
Server Actions, parsing user-uploaded spreadsheets), re-run `npm audit` and
address them before shipping that feature.
