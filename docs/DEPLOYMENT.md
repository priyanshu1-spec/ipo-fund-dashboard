# Deployment Guide (Vercel)

The app is a standard Next.js 14 App Router project — Vercel is the path of
least resistance (built by the same team, zero-config, free tier is plenty
for personal/family use, includes Cron).

## 1. Push this repo to GitHub (or GitLab/Bitbucket)

Vercel deploys from a git repo.

## 2. Import into Vercel

1. [vercel.com/new](https://vercel.com/new) → import your repo.
2. Framework preset: **Next.js** (auto-detected).
3. Before the first deploy, add all environment variables from
   [`.env.example`](../.env.example) under **Project Settings → Environment
   Variables** (Production **and** Preview, so preview deployments also work):
   - `NEXTAUTH_SECRET`
   - `NEXTAUTH_URL` → set this to your final Vercel URL, e.g.
     `https://ipo-fund-dashboard.vercel.app` (or your custom domain)
   - `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`
   - `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`
     (paste the multi-line key as-is; Vercel's env editor handles newlines —
     if pasting as a single line, keep the literal `\n` sequences)
   - `GOOGLE_SHEET_ID`
   - `BOOTSTRAP_ADMIN_EMAILS`
   - `CRON_SECRET`
   - Optionally `IPO_SYNC_SOURCES` (see below)
4. Click **Deploy**.

## 3. Finish the Google OAuth redirect URI

Once deployed, go back to Google Cloud Console → your OAuth Client → add:

```
https://YOUR-VERCEL-DOMAIN/api/auth/callback/google
```

to **Authorized redirect URIs**. Without this, Google sign-in fails with
`redirect_uri_mismatch`.

## 4. Automated daily IPO sync (Vercel Cron)

[`vercel.json`](../vercel.json) already defines a daily cron job hitting
`/api/cron/sync-ipos` at 03:00 UTC. Vercel automatically attaches
`Authorization: Bearer $CRON_SECRET` to requests it triggers for cron jobs
when `CRON_SECRET` is set as an env var on the project — no extra wiring
needed, the route handler checks for that header. Cron Jobs are available on
Vercel's free Hobby tier for one job at this frequency.

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
add/edit on the `/ipos` page as your reliable fallback. If you'd rather run
automation from Google's own infrastructure (which has normal, unrestricted
outbound internet access), use
[`scripts/apps-script/Code.gs`](../scripts/apps-script/Code.gs) instead/as well
— see that file's header comment for setup.

You can also trigger a sync any time from the UI (`/ipos` → **Sync Now**), or
manually hit the cron endpoint yourself:
`curl -H "Authorization: Bearer $CRON_SECRET" https://YOUR-DOMAIN/api/cron/sync-ipos`.

## 5. Custom domain (optional)

**Project Settings → Domains** → add your domain, follow the DNS
instructions. Remember to add the new domain's OAuth callback URL in Google
Cloud too, and update `NEXTAUTH_URL`.

## 6. Giving other people access

Sharing the URL alone does **not** give anyone access — see
[`GOOGLE_SHEETS_SETUP.md`](./GOOGLE_SHEETS_SETUP.md) §6. Only Google accounts
you've explicitly granted a role to (via **Settings → Access & Permissions**,
or listed in `BOOTSTRAP_ADMIN_EMAILS`) can sign in.

## 7. Backups

**Export to Excel** (top-left nav, or `/api/export`) downloads a full
multi-sheet `.xlsx` snapshot of every tab plus the computed investor ledger —
useful for tax filing or an off-Sheets backup. The Google Sheet itself also
keeps Google's built-in version history (File → Version history in the
Sheets UI) for point-in-time recovery.

## Known residual `npm audit` findings

`npm audit` will report a handful of advisories against transitive
dependencies (Next.js edge cases around Image Optimizer/i18n/Server Actions
that this app doesn't use; a moderate `uuid` bounds-check issue several
levels deep inside `googleapis`; and `xlsx`, which we only ever *write* with,
never parse untrusted input through). None apply to how this app actually
uses them, but if you later add features that touch those code paths
(next/image, Server Actions, parsing user-uploaded spreadsheets), re-run
`npm audit` and address them before shipping that feature.
