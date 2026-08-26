import { NextResponse } from "next/server";
import { isAuthedContext, requireApiAuth, scopeFor } from "@/lib/apiAuth";
import { deleteInvestor, getInvestor, updateInvestor } from "@/lib/repositories/investors";
import { recordActivity } from "@/lib/repositories/activityLog";

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireApiAuth("editor");
  if (!isAuthedContext(auth)) return auth;
  const patch = await req.json();
  try {
    const investor = await updateInvestor(params.id, patch, scopeFor(auth));
    await recordActivity({
      userId: auth.userId,
      userName: auth.actor,
      action: "update",
      entityType: "investor",
      entityId: investor.id,
      entityLabel: investor.name,
    });
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
  const existing = await getInvestor(params.id, scopeFor(auth));
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await deleteInvestor(params.id, scopeFor(auth));
  await recordActivity({
    userId: auth.userId,
    userName: auth.actor,
    action: "delete",
    entityType: "investor",
    entityId: params.id,
    entityLabel: existing.name,
  });
  return NextResponse.json({ ok: true });
}
