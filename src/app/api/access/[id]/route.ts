import { NextResponse } from "next/server";
import { isAuthedContext, requireApiAuth } from "@/lib/apiAuth";
import { deleteAccessRow, revokeAccess, updateAccess } from "@/lib/repositories/access";
import { logAudit } from "@/lib/repositories/auditLog";

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireApiAuth("admin");
  if (!isAuthedContext(auth)) return auth;
  const patch = await req.json();
  try {
    const row = await updateAccess(params.id, patch);
    await logAudit(auth.email, "update-access", "Access", row.id, `${row.email} (${row.role}, ${row.status})`);
    return NextResponse.json({ row });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Update failed" },
      { status: 404 }
    );
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireApiAuth("admin");
  if (!isAuthedContext(auth)) return auth;
  const url = new URL(req.url);
  const hard = url.searchParams.get("hard") === "true";
  if (hard) {
    await deleteAccessRow(params.id);
    await logAudit(auth.email, "delete-access", "Access", params.id, "");
  } else {
    const row = await revokeAccess(params.id);
    await logAudit(auth.email, "revoke-access", "Access", row.id, row.email);
  }
  return NextResponse.json({ ok: true });
}
