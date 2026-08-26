import { NextResponse } from "next/server";
import { isAuthedContext, requireApiAuth } from "@/lib/apiAuth";
import { ensureSchema, sql } from "@/lib/db";
import type { FetchLogEntry } from "@/types";

export async function GET() {
  const auth = await requireApiAuth("editor");
  if (!isAuthedContext(auth)) return auth;

  await ensureSchema();
  const { rows } = await sql`SELECT * FROM ipo_fetch_logs ORDER BY started_at DESC LIMIT 100`;
  const logs: FetchLogEntry[] = rows.map((r) => ({
    id: String(r.id),
    provider: String(r.provider),
    startedAt: String(r.started_at),
    completedAt: r.completed_at == null ? null : String(r.completed_at),
    success: Boolean(r.success),
    recordsFound: Number(r.records_found ?? 0),
    recordsInserted: Number(r.records_inserted ?? 0),
    recordsUpdated: Number(r.records_updated ?? 0),
    errorMessage: String(r.error_message ?? ""),
  }));
  return NextResponse.json({ logs });
}
