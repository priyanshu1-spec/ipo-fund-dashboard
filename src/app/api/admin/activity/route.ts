import { NextResponse } from "next/server";
import { isAuthedContext, requireApiAuth } from "@/lib/apiAuth";
import { listRecentActivity } from "@/lib/repositories/activityLog";

export async function GET() {
  const auth = await requireApiAuth("admin");
  if (!isAuthedContext(auth)) return auth;
  const entries = await listRecentActivity();
  return NextResponse.json({ entries });
}
