import { NextResponse } from "next/server";
import { isAuthedContext, requireApiAuth } from "@/lib/apiAuth";
import { deleteIpo, getIpo, updateIpo } from "@/lib/repositories/ipos";
import { recordActivity } from "@/lib/repositories/activityLog";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireApiAuth("viewer");
  if (!isAuthedContext(auth)) return auth;
  const ipo = await getIpo(params.id);
  if (!ipo) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ipo });
}

// Shared/global data (see api/ipos/route.ts) — write access is admin-only.
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireApiAuth("admin");
  if (!isAuthedContext(auth)) return auth;
  const patch = await req.json();
  try {
    const ipo = await updateIpo(params.id, patch);
    await recordActivity({
      userId: auth.userId,
      userName: auth.actor,
      action: "update",
      entityType: "ipo",
      entityId: ipo.id,
      entityLabel: ipo.name,
    });
    return NextResponse.json({ ipo });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Update failed" },
      { status: 404 }
    );
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireApiAuth("admin");
  if (!isAuthedContext(auth)) return auth;
  const existing = await getIpo(params.id);
  await deleteIpo(params.id);
  await recordActivity({
    userId: auth.userId,
    userName: auth.actor,
    action: "delete",
    entityType: "ipo",
    entityId: params.id,
    entityLabel: existing?.name ?? params.id,
  });
  return NextResponse.json({ ok: true });
}
