import { NextResponse } from "next/server";
import { isAuthedContext, requireApiAuth } from "@/lib/apiAuth";
import { deleteInvestor, updateInvestor } from "@/lib/repositories/investors";
import { logAudit } from "@/lib/repositories/auditLog";

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireApiAuth("editor");
  if (!isAuthedContext(auth)) return auth;
  const patch = await req.json();
  try {
    const investor = await updateInvestor(params.id, patch);
    await logAudit(auth.actor, "update", "Investor", investor.id, investor.name);
    return NextResponse.json({ investor });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Update failed" },
      { status: 404 }
    );
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireApiAuth("editor");
  if (!isAuthedContext(auth)) return auth;
  await deleteInvestor(params.id);
  await logAudit(auth.actor, "delete", "Investor", params.id, "");
  return NextResponse.json({ ok: true });
}
