import { NextResponse } from "next/server";
import { isAuthedContext, requireApiAuth } from "@/lib/apiAuth";
import { ensureSchema, sql } from "@/lib/db";
import type { SourceHealth } from "@/types";

export async function GET() {
  const auth = await requireApiAuth("editor");
  if (!isAuthedContext(auth)) return auth;

  await ensureSchema();
  const { rows } = await sql`SELECT * FROM ipo_sources ORDER BY provider ASC`;
  const sources: SourceHealth[] = rows.map((r) => ({
    provider: String(r.provider),
    status: (r.status as SourceHealth["status"]) || "unknown",
    lastSuccessAt: String(r.last_success_at ?? ""),
    lastError: String(r.last_error ?? ""),
    lastRunAt: String(r.last_run_at ?? ""),
  }));

  // "Manual" is always available — it's you typing data in, not a fetch that can fail.
  if (!sources.some((s) => s.provider === "manual")) {
    sources.push({ provider: "manual", status: "healthy", lastSuccessAt: "", lastError: "", lastRunAt: "" });
  }

  return NextResponse.json({ sources });
}
