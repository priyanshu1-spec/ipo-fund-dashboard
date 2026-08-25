// ============================================================================
// Postgres data-access layer.
//
// The database lives entirely inside your Vercel project (Storage tab ->
// Create Database -> Postgres, which today provisions via Vercel's native
// Neon integration, then "Connect Project"). Vercel injects DATABASE_URL /
// POSTGRES_URL env vars automatically once connected — nothing to configure
// by hand. Locally, `vercel env pull .env.local` (after connecting the store
// in the dashboard) copies those same values down for `npm run dev`. See
// docs/DEPLOYMENT.md.
//
// Uses @neondatabase/serverless (the client Vercel's Postgres/Neon
// integration recommends) over an HTTP-based connection — no connection
// pooling to manage, works well in serverless route handlers.
//
// Tables are created automatically on first use (see ensureSchema below) —
// there's no separate migration step to run.
// ============================================================================

import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

type SqlTag = NeonQueryFunction<false, true>;

let cachedSql: SqlTag | null = null;

/** Lazily creates the Neon client on first real query, not at module import — so a missing env var only breaks the request that needs the DB, not the whole build/cold start. */
function getSqlFn(): SqlTag {
  if (cachedSql) return cachedSql;
  const url = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
  if (!url) {
    throw new Error(
      "No database connection string found (DATABASE_URL / POSTGRES_URL). " +
        "Connect a Postgres store to this Vercel project — see docs/DEPLOYMENT.md."
    );
  }
  // fullResults gives back { rows, rowCount, ... } like node-postgres, matching
  // how every repository in this app consumes query results.
  cachedSql = neon(url, { fullResults: true });
  return cachedSql;
}

export interface QueryResult {
  rows: Record<string, unknown>[];
}

/** Tagged-template query function — usage: `await sql\`SELECT ...\`` — matching every repository's call sites. */
export function sql(strings: TemplateStringsArray, ...values: unknown[]): Promise<QueryResult> {
  return getSqlFn()(strings, ...values) as unknown as Promise<QueryResult>;
}

let schemaReady: Promise<void> | null = null;

/** Idempotently creates every table this app needs. Safe to call repeatedly. */
export function ensureSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = runSchema().catch((err) => {
      // Let the next call retry instead of caching a permanent failure
      // (e.g. a transient connection error during cold start).
      schemaReady = null;
      throw err;
    });
  }
  return schemaReady;
}

async function runSchema(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS ipos (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL DEFAULT '',
      type TEXT NOT NULL DEFAULT 'Mainboard',
      open_date TEXT NOT NULL DEFAULT '',
      close_date TEXT NOT NULL DEFAULT '',
      allotment_date TEXT NOT NULL DEFAULT '',
      refund_date TEXT NOT NULL DEFAULT '',
      listing_date TEXT NOT NULL DEFAULT '',
      price_band_min NUMERIC NOT NULL DEFAULT 0,
      price_band_max NUMERIC NOT NULL DEFAULT 0,
      lot_size NUMERIC NOT NULL DEFAULT 0,
      issue_size TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'Upcoming',
      gmp NUMERIC NOT NULL DEFAULT 0,
      gmp_updated_at TEXT NOT NULL DEFAULT '',
      listing_price NUMERIC,
      exchange TEXT NOT NULL DEFAULT '',
      source_url TEXT NOT NULL DEFAULT '',
      last_synced_at TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT ''
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS investors (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL DEFAULT '',
      relationship TEXT NOT NULL DEFAULT '',
      phone TEXT NOT NULL DEFAULT '',
      email TEXT NOT NULL DEFAULT '',
      default_bank_account TEXT NOT NULL DEFAULT '',
      default_bank_ifsc TEXT NOT NULL DEFAULT '',
      demand_account_number TEXT NOT NULL DEFAULT '',
      pan_masked TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'Active',
      created_at TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT ''
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS applications (
      id TEXT PRIMARY KEY,
      ipo_id TEXT NOT NULL DEFAULT '',
      ipo_name TEXT NOT NULL DEFAULT '',
      applied_in_name_of TEXT NOT NULL DEFAULT '',
      investor_id TEXT NOT NULL DEFAULT '',
      pan_masked TEXT NOT NULL DEFAULT '',
      application_number TEXT NOT NULL DEFAULT '',
      upi_id TEXT NOT NULL DEFAULT '',
      category TEXT NOT NULL DEFAULT 'Retail',
      lots_applied NUMERIC NOT NULL DEFAULT 0,
      amount_blocked NUMERIC NOT NULL DEFAULT 0,
      payment_mode TEXT NOT NULL DEFAULT 'UPI',
      allotment_status TEXT NOT NULL DEFAULT 'Pending',
      lots_allotted NUMERIC NOT NULL DEFAULT 0,
      amount_allotted NUMERIC NOT NULL DEFAULT 0,
      refund_amount NUMERIC NOT NULL DEFAULT 0,
      refund_status TEXT NOT NULL DEFAULT 'N/A',
      refund_date TEXT NOT NULL DEFAULT '',
      sell_date TEXT NOT NULL DEFAULT '',
      sell_price NUMERIC NOT NULL DEFAULT 0,
      created_by TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT ''
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS fund_allocations (
      id TEXT PRIMARY KEY,
      application_id TEXT NOT NULL DEFAULT '',
      ipo_name TEXT NOT NULL DEFAULT '',
      investor_id TEXT NOT NULL DEFAULT '',
      investor_name TEXT NOT NULL DEFAULT '',
      source TEXT NOT NULL DEFAULT 'Self',
      amount_contributed NUMERIC NOT NULL DEFAULT 0,
      date_received TEXT NOT NULL DEFAULT '',
      repayment_bank_account TEXT NOT NULL DEFAULT '',
      amount_repaid NUMERIC NOT NULL DEFAULT 0,
      repayment_date TEXT NOT NULL DEFAULT '',
      profit_share_amount NUMERIC NOT NULL DEFAULT 0,
      profit_share_status TEXT NOT NULL DEFAULT 'N/A',
      created_at TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT ''
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS audit_log (
      id TEXT PRIMARY KEY,
      "timestamp" TEXT NOT NULL DEFAULT '',
      actor TEXT NOT NULL DEFAULT '',
      action TEXT NOT NULL DEFAULT '',
      entity_type TEXT NOT NULL DEFAULT '',
      entity_id TEXT NOT NULL DEFAULT '',
      details TEXT NOT NULL DEFAULT ''
    );
  `;
}
