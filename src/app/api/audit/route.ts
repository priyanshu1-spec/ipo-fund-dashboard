import { NextResponse } from "next/server";
import { isAuthedContext, requireApiAuth } from "@/lib/apiAuth";
import { listRecentAuditLog } from "@/lib/repositories/auditLog";

export async function GET() {
  const auth = await requireApiAuth("editor");
  if (!isAuthedContext(auth)) return auth;
  const entries = await listRecentAuditLog(200);
  return NextResponse.json({ entries });
}
