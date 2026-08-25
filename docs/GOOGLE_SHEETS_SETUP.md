# Google Cloud & Google Sheets Setup

This app uses **one Google Sheet as its entire database** and **Google Sign-In** as
its entire access-control system. You need two separate Google Cloud
credentials:

1. A **Service Account** (server-to-server) — lets the app read/write your Sheet.
2. An **OAuth Client ID** (web) — lets people sign in with their Google account.

Both live in the same free Google Cloud project.

---

## 1. Create a Google Cloud project

1. Go to [console.cloud.google.com](https://console.cloud.google.com/) and create a
   new project (e.g. "ipo-fund-dashboard").
2. In **APIs & Services → Library**, enable:
   - **Google Sheets API**

---

## 2. Create the Service Account (Sheets access)

1. **APIs & Services → Credentials → Create Credentials → Service Account.**
2. Name it anything (e.g. `ipo-dashboard-bot`). No project role needed — skip
   the optional "grant access" steps.
3. Open the new service account → **Keys → Add Key → Create new key → JSON**.
   A `.json` file downloads — keep it private, never commit it.
4. From that JSON file you need two values for your `.env`:
   - `client_email` → `GOOGLE_SERVICE_ACCOUNT_EMAIL`
   - `private_key` → `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` (keep the `\n`
     sequences exactly as they appear in the JSON, wrapped in quotes)

## 3. Create the Google Sheet

1. Create a new blank Google Sheet — this is your database. Any name is fine.
2. Copy the **Spreadsheet ID** from its URL:
   `https://docs.google.com/spreadsheets/d/`**`THIS_PART`**`/edit`
   → set as `GOOGLE_SHEET_ID`.
3. Click **Share** and add the service account's `client_email` (from step 2)
   as an **Editor**. This is the only "user" the app ever authenticates to
   Sheets as — your own Google account does not need edit access unless you
   also want to look at the raw sheet.
4. You do **not** need to create the tabs/headers yourself — the app calls
   `ensureTab()` the first time it needs a tab and creates it with the right
   headers automatically. If you'd rather set them up by hand first (e.g. to
   review the schema), see [`SCHEMA.md`](./SCHEMA.md) for the exact tab names
   and column order.

## 4. Create the OAuth Client (sign-in)

1. **APIs & Services → OAuth consent screen.**
   - User type: **External** (unless you have Google Workspace, then **Internal** is simpler).
   - Fill in app name, your email as support/developer contact.
   - Scopes: none needed beyond the default `email`/`profile`/`openid`.
   - Test users (if using External + "Testing" publish status): add every
     email you plan to grant access to, or click **Publish App** so any
     Google account can attempt sign-in — remember the app's own
     `Access_Control` sheet (see below) is what actually gates entry, not
     this OAuth screen.
2. **APIs & Services → Credentials → Create Credentials → OAuth client ID.**
   - Application type: **Web application**.
   - Authorized redirect URIs, add both:
     - `http://localhost:3000/api/auth/callback/google` (local dev)
     - `https://YOUR-DEPLOYED-DOMAIN/api/auth/callback/google` (production —
       add this once you know your Vercel URL / custom domain)
3. Copy the **Client ID** and **Client Secret** into `.env`:
   - `GOOGLE_OAUTH_CLIENT_ID`
   - `GOOGLE_OAUTH_CLIENT_SECRET`

## 5. Set the remaining env vars

- `NEXTAUTH_SECRET` — generate with `openssl rand -base64 32`.
- `NEXTAUTH_URL` — `http://localhost:3000` locally, your real domain in prod.
- `BOOTSTRAP_ADMIN_EMAILS` — your own Google account email(s), comma-separated.
  This is what guarantees you can always sign in as admin even before you've
  added anyone to the `Access_Control` sheet tab — you can never lock yourself
  out.
- `CRON_SECRET` — any long random string, used to authorize the scheduled IPO
  sync endpoint.

See [`.env.example`](../.env.example) for the full list with inline comments.

## 6. Granting access to other people

Once the app is running, sign in yourself (you're a bootstrap admin), go to
**Settings → Access & Permissions**, and click **Grant Access** for each
person's Google account email, choosing their role:

- **Viewer** — read-only dashboards, no edit/delete.
- **Editor** — can add/edit IPOs, applications, funds, investors.
- **Admin** — everything Editor can do, plus manage who has access and delete
  records.

Only emails present (and `active`) in that list, or in
`BOOTSTRAP_ADMIN_EMAILS`, can sign in at all — everyone else is redirected to
`/access-denied`. Revoking someone just flips their row to `revoked`; their
next sign-in attempt is rejected, no need to touch Google Cloud.

## 7. Google Sheets API quota

The free tier allows 60 read requests and 60 write requests per minute per
user (the service account, in this case). The app's built-in 15-second
in-memory cache on reads keeps normal personal/family use nowhere near that
limit; if you ever hit quota errors, it's almost always many people mashing
"Sync Now" simultaneously.
