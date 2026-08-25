import { NextResponse } from "next/server";
import { z } from "zod";
import { isAuthedContext, requireApiAuth } from "@/lib/apiAuth";
import { grantAccess, listAccessRows } from "@/lib/repositories/access";
import { logAudit } from "@/lib/repositories/auditLog";

const grantSchema = z.object({
  email: z.string().email(),
  role: z.enum(["admin", "editor", "viewer"]),
  notes: z.string().optional().default(""),
});

// Only admins can view or modify the allowlist — this is who controls who
// gets into the app at all.
export async function GET() {
  const auth = await requireApiAuth("admin");
  if (!isAuthedContext(auth)) return auth;
  const rows = await listAccessRows();
  return NextResponse.json({ rows });
}

export async function POST(req: Request) {
  const auth = await requireApiAuth("admin");
  if (!isAuthedContext(auth)) return auth;

  const body = await req.json();
  const parsed = grantSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const row = await grantAccess(parsed.data.email, parsed.data.role, auth.email, parsed.data.notes);
  await logAudit(auth.email, "grant-access", "Access", row.id, `${row.email} (${row.role})`);
  return NextResponse.json({ row }, { status: 201 });
}
