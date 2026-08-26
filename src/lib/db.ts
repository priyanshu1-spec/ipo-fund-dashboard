// ============================================================================
// Postgres data-access layer.
//
// Works with ANY standard Postgres connection string in DATABASE_URL (or
// POSTGRES_URL) — Neon, Supabase, Vercel Postgres, a self-hosted instance,
// whatever you point it at. Set that one env var and you're done.
//
// Uses a short-lived `pg` client per query rather than a long-lived pool —
// simplest thing that works correctly across serverless function cold
// starts, and free-tier Postgres providers cap concurrent connections low
// enough that a persistent pool per instance can actually exhaust them for
// an app this size faster than connect-per-query does.
//
// Tables are created automatically on first use (see ensureSchema below) —
// there's no separate migration step to run.
// ============================================================================

import { Client } from "pg";

function connectionString(): string {
  const url = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
  if (!url) {
    throw new Error(
      "No database connection string found (DATABASE_URL / POSTGRES_URL). " +
        "Connect a Postgres database and set that env var — see docs/DEPLOYMENT.md."
    );
  }
  return url;
}

export interface QueryResult {
  rows: Record<string, unknown>[];
}

/** Raw parameterized query — use this directly when the column list is built dynamically (see repositories/ipos.ts insert/update); prefer the `sql` tag for everything else. */
export async function query(text: string, values: unknown[]): Promise<QueryResult> {
  const client = new Client({
    connectionString: connectionString(),
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  try {
    const res = await client.query(text, values);
    return { rows: res.rows };
  } finally {
    await client.end();
  }
}

/** Tagged-template query function — usage: `await sql\`SELECT ...\`` . Interpolated values become $1, $2, ... parameters. */
export function sql(strings: TemplateStringsArray, ...values: unknown[]): Promise<QueryResult> {
  let text = strings[0];
  for (let i = 0; i < values.length; i++) {
    text += `$${i + 1}` + strings[i + 1];
  }
  return query(text, values);
}

let schemaReady: Promise<void> | null = null;

/** Idempotently creates every table this app needs. Safe to call repeatedly. */
export function ensureSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = runSchema().catch((err) => {
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
      symbol TEXT NOT NULL DEFAULT '',
      type TEXT NOT NULL DEFAULT 'Mainboard',
      issue_type TEXT NOT NULL DEFAULT '',
      open_date TEXT NOT NULL DEFAULT '',
      close_date TEXT NOT NULL DEFAULT '',
      allotment_date TEXT NOT NULL DEFAULT '',
      refund_date TEXT NOT NULL DEFAULT '',
      listing_date TEXT NOT NULL DEFAULT '',
      price_band_min NUMERIC NOT NULL DEFAULT 0,
      price_band_max NUMERIC NOT NULL DEFAULT 0,
      face_value NUMERIC,
      lot_size NUMERIC,
      min_investment NUMERIC,
      issue_size TEXT NOT NULL DEFAULT '',
      fresh_issue_size TEXT NOT NULL DEFAULT '',
      offer_for_sale_size TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'Upcoming',
      registrar TEXT NOT NULL DEFAULT '',
      lead_managers TEXT NOT NULL DEFAULT '',
      qib_subscription NUMERIC,
      nii_subscription NUMERIC,
      retail_subscription NUMERIC,
      employee_subscription NUMERIC,
      shareholder_subscription NUMERIC,
      overall_subscription NUMERIC,
      gmp NUMERIC,
      gmp_updated_at TEXT NOT NULL DEFAULT '',
      listing_price NUMERIC,
      listing_gain_percent NUMERIC,
      exchange TEXT NOT NULL DEFAULT '',
      is_official BOOLEAN NOT NULL DEFAULT FALSE,
      data_source TEXT NOT NULL DEFAULT 'Manual',
      source_url TEXT NOT NULL DEFAULT '',
      last_synced_at TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT ''
    );
  `;

  // Migration: lot_size used to be NOT NULL DEFAULT 0, which silently turned
  // "NSE didn't publish this yet" into a fabricated 0. A table created before
  // this change still carries that constraint even though CREATE TABLE IF
  // NOT EXISTS above won't touch it — drop it explicitly. No-op (and safe to
  // run every cold start) once already applied.
  await sql`ALTER TABLE ipos ALTER COLUMN lot_size DROP NOT NULL;`;
  await sql`ALTER TABLE ipos ALTER COLUMN lot_size DROP DEFAULT;`;

  await sql`
    CREATE TABLE IF NOT EXISTS ipo_gmp_history (
      id TEXT PRIMARY KEY,
      ipo_id TEXT NOT NULL REFERENCES ipos(id) ON DELETE CASCADE,
      gmp NUMERIC NOT NULL,
      recorded_at TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT ''
    );
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_gmp_history_ipo ON ipo_gmp_history(ipo_id, recorded_at);`;

  await sql`
    CREATE TABLE IF NOT EXISTS ipo_subscription_history (
      id TEXT PRIMARY KEY,
      ipo_id TEXT NOT NULL REFERENCES ipos(id) ON DELETE CASCADE,
      qib NUMERIC,
      nii NUMERIC,
      retail NUMERIC,
      employee NUMERIC,
      shareholder NUMERIC,
      overall NUMERIC,
      recorded_at TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT ''
    );
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_sub_history_ipo ON ipo_subscription_history(ipo_id, recorded_at);`;

  await sql`
    CREATE TABLE IF NOT EXISTS ipo_fetch_logs (
      id TEXT PRIMARY KEY,
      provider TEXT NOT NULL,
      started_at TEXT NOT NULL,
      completed_at TEXT,
      success BOOLEAN NOT NULL DEFAULT FALSE,
      records_found INTEGER NOT NULL DEFAULT 0,
      records_inserted INTEGER NOT NULL DEFAULT 0,
      records_updated INTEGER NOT NULL DEFAULT 0,
      error_message TEXT NOT NULL DEFAULT ''
    );
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_fetch_logs_started ON ipo_fetch_logs(started_at DESC);`;

  await sql`
    CREATE TABLE IF NOT EXISTS ipo_sources (
      provider TEXT PRIMARY KEY,
      status TEXT NOT NULL DEFAULT 'unknown',
      last_success_at TEXT NOT NULL DEFAULT '',
      last_error TEXT NOT NULL DEFAULT '',
      last_run_at TEXT NOT NULL DEFAULT ''
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS investors (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL DEFAULT 'admin',
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
      owner_id TEXT NOT NULL DEFAULT 'admin',
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
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL DEFAULT '',
      role TEXT NOT NULL DEFAULT 'viewer',
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL DEFAULT '',
      approved_at TEXT NOT NULL DEFAULT '',
      approved_by TEXT NOT NULL DEFAULT '',
      last_active_at TEXT NOT NULL DEFAULT ''
    );
  `;
  // Migration for a table created before last_active_at existed.
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_active_at TEXT NOT NULL DEFAULT '';`;

  await sql`
    CREATE TABLE IF NOT EXISTS activity_log (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL DEFAULT '',
      user_name TEXT NOT NULL DEFAULT '',
      action TEXT NOT NULL DEFAULT '',
      entity_type TEXT NOT NULL DEFAULT '',
      entity_id TEXT NOT NULL DEFAULT '',
      entity_label TEXT NOT NULL DEFAULT '',
      details TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT ''
    );
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_activity_log_created ON activity_log(created_at DESC);`;

  await sql`
    CREATE TABLE IF NOT EXISTS fund_allocations (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL DEFAULT 'admin',
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
}
