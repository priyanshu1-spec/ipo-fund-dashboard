import { NextResponse } from "next/server";
import { isAuthedContext, requireApiAuth } from "@/lib/apiAuth";
import { deleteFundAllocation, updateFundAllocation } from "@/lib/repositories/funds";
import { logAudit } from "@/lib/repositories/auditLog";

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireApiAuth("editor");
  if (!isAuthedContext(auth)) return auth;
  const patch = await req.json();
  try {
    const fund = await updateFundAllocation(params.id, patch);
    await logAudit(auth.actor, "update", "FundAllocation", fund.id, fund.ipoName);
    return NextResponse.json({ fund });
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
  await deleteFundAllocation(params.id);
  await logAudit(auth.actor, "delete", "FundAllocation", params.id, "");
  return NextResponse.json({ ok: true });
}
