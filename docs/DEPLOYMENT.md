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
   | `BOOTSTRAP_ADMIN_USERNAME` | pick a username for yourself, e.g. `admin` |
   | `BOOTSTRAP_ADMIN_PASSWORD` | pick a strong password — this always works, so you can never lock yourself out |
   | `NEXTAUTH_SECRET` | generate with `openssl rand -base64 32` |
   | `NEXTAUTH_URL` | leave blank for now — fill in after step 4 |
   | `CRON_SECRET` | any long random string |
   | `IPO_SYNC_SOURCES` | optional, see `docs/DEPLOYMENT.md` §6 below |

4. Click **Deploy**. You'll get a URL like `your-project.vercel.app`.
5. Go back to Environment Variables, set `NEXTAUTH_URL` to that exact URL
   (e.g. `https://your-project.vercel.app`), then **redeploy** (Deployments
   tab → ⋯ → Redeploy) so it picks up the change.

## 3. Connect the database (free, pick any provider)

The app works with a plain Postgres connection string in `DATABASE_URL` —
you're not locked into one provider. Two easy free options:

**Option A — Neon** (neon.tech): sign up free (no card) → create a project →
copy the **Connection string** shown on the project dashboard (starts with
`postgresql://`).

**Option B — Supabase** (supabase.com): sign up free (no card) → create a
project → **Project Settings → Database → Connection string** → copy the
"URI" one (starts with `postgresql://`).

**Option C — Vercel Postgres**: Storage tab → Create Database → Postgres →
Connect Project. Vercel injects its own `POSTGRES_URL` automatically, which
the app also reads if `DATABASE_URL` isn't set.

Whichever you pick:

1. Vercel → your project → **Settings → Environment Variables → Add New**
2. Key: `DATABASE_URL`, Value: the connection string you copied
3. Save → **Deployments** → ⋯ → **Redeploy**

That's it — the app creates its own tables the first time it runs (see
`src/lib/db.ts`), no migration step to run by hand. For local dev, put the
same value in `.env.local`.

## 4. Sign in

Open your Vercel URL → sign in with `BOOTSTRAP_ADMIN_USERNAME` /
`BOOTSTRAP_ADMIN_PASSWORD`. You're in with full access.

## 5. Give people their own access

Go to **Settings → Manage Users → Add User**, pick them a username and
password, and choose their role:

- **Viewer** — read-only, can't add/edit/delete anything.
- **Editor** — full access, including managing other users' accounts.

Send them the URL plus their own username/password. To cut someone off,
click the revoke icon next to their name (or delete their account entirely)
— nobody else is affected. Your bootstrap admin login always keeps working
even if every other account is revoked or deleted, so you can never lock
yourself out.

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
for tax filing or an off-platform backup. Most managed Postgres providers
(Neon, Supabase, Vercel Postgres) also keep automatic point-in-time backups
on their own free tier.

## Known residual `npm audit` findings

`npm audit` will report a handful of advisories against transitive
dependencies (Next.js edge cases around Image Optimizer/i18n/Server Actions
that this app doesn't use, and `xlsx`, which we only ever *write* with, never
parse untrusted input through). None apply to how this app actually uses
them, but if you later add features that touch those code paths (next/image,
Server Actions, parsing user-uploaded spreadsheets), re-run `npm audit` and
address them before shipping that feature.
