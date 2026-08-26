import { NextResponse } from "next/server";
import { isAuthedContext, requireApiAuth, scopeFor } from "@/lib/apiAuth";
import { deleteFundAllocation, getFundAllocation, updateFundAllocation } from "@/lib/repositories/funds";
import { recordActivity } from "@/lib/repositories/activityLog";

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireApiAuth("editor");
  if (!isAuthedContext(auth)) return auth;
  const patch = await req.json();
  try {
    const fund = await updateFundAllocation(params.id, patch, scopeFor(auth));
    await recordActivity({
      userId: auth.userId,
      userName: auth.actor,
      action: "update",
      entityType: "fund",
      entityId: fund.id,
      entityLabel: fund.ipoName,
    });
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
  const existing = await getFundAllocation(params.id, scopeFor(auth));
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await deleteFundAllocation(params.id, scopeFor(auth));
  await recordActivity({
    userId: auth.userId,
    userName: auth.actor,
    action: "delete",
    entityType: "fund",
    entityId: params.id,
    entityLabel: existing.ipoName,
  });
  return NextResponse.json({ ok: true });
}
