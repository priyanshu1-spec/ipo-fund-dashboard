# Deployment Guide (Vercel — free)

There is no database and no backend storage to set up. This app keeps all
its data in the browser's `localStorage` — deployment is just the app code.

## 1. Push this repo to GitHub (or GitLab/Bitbucket)

Vercel deploys from a git repo.

## 2. Import into Vercel

1. [vercel.com/new](https://vercel.com/new) — sign up free (GitHub login
   works), import this repo.
2. Framework preset: **Next.js** (auto-detected). Keep the **Hobby** plan —
   it's free forever.
3. Before the first deploy, add these Environment Variables (Production
   **and** Preview):

   | Variable | Value |
   |---|---|
   | `APP_ACCESS_PASSWORD` | pick a password — this is what you'll share to give someone full access |
   | `APP_VIEWER_PASSWORD` | optional — a second password for read-only access, or leave unset |
   | `NEXTAUTH_SECRET` | generate with `openssl rand -base64 32` |
   | `NEXTAUTH_URL` | leave blank for now — fill in after step 4 |

4. Click **Deploy**. You'll get a URL like `your-project.vercel.app`.
5. Go back to Environment Variables, set `NEXTAUTH_URL` to that exact URL
   (e.g. `https://your-project.vercel.app`), then **redeploy** (Deployments
   tab → ⋯ → Redeploy) so it picks up the change.

## 3. Sign in

Open your Vercel URL → enter the password you set as `APP_ACCESS_PASSWORD`.
You're in with full access.

## 4. Share it

Just send people the URL and the password (the viewer password, if you set
one, for anyone who should only look, not edit).

**Read this before sharing with more than one person**: because there's no
database, everyone's data lives only in *their own* browser. If you and
someone else both open the dashboard, you will each see your own separate,
empty starting point — nothing is shared between you, even though you use
the same link and password. Each person is tracking independently in this
setup. If you want everyone to see and edit the *same* shared data, that
needs a database behind it — a meaningfully different architecture; ask if
you'd like that version instead.

**To revoke access for everyone at once**: change `APP_ACCESS_PASSWORD`
(and/or `APP_VIEWER_PASSWORD`) in Environment Variables, then redeploy.

## 5. Automated IPO sync (client-side, best-effort)

The "Sync Now" button on the IPO Market Watch page runs entirely in your
browser: it fetches a public IPO listing page through a free CORS proxy
(`api.allorigins.win`, needed because browsers block direct cross-site
fetches) and looks for a recognizable data table in the result. This is
inherently less reliable than a server-side fetch would be — the proxy
itself can be slow, rate-limited, or down, on top of the target site
possibly blocking automated visits or needing JavaScript to render its data
(which this plain-HTML reader can't run). See
[`src/lib/clientIpoSync.ts`](../src/lib/clientIpoSync.ts) for the full
reasoning. Manual **Add IPO** and **Bulk Import JSON** always work
regardless of sync health.

To point it at different sources, set `NEXT_PUBLIC_IPO_SYNC_SOURCES` (see
`.env.example`) — comma-separated `url|Mainboard` / `url|SME` pairs.

## 6. Custom domain (optional)

**Project Settings → Domains** → add your domain, follow the DNS
instructions, then update `NEXTAUTH_URL` and redeploy.

## 7. Backups

Since your data lives only in this browser, **Export to Excel** (sidebar) is
your actual backup mechanism, not just a convenience — export regularly.
There is no server-side copy of your data anywhere.

## Known residual `npm audit` findings

`npm audit` may report advisories against Next.js itself (edge cases around
Image Optimizer/i18n/Server Actions this app doesn't use) and `xlsx` (which
this app only ever *writes* with — export — never parses untrusted input
through). Neither applies to how this app actually uses them.
