import { NextResponse } from "next/server";
import { isAuthedContext, requireApiAuth, scopeFor } from "@/lib/apiAuth";
import { deleteApplication, getApplication, updateApplication } from "@/lib/repositories/applications";
import { recordActivity } from "@/lib/repositories/activityLog";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireApiAuth("viewer");
  if (!isAuthedContext(auth)) return auth;
  const application = await getApplication(params.id, scopeFor(auth));
  if (!application) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ application });
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireApiAuth("editor");
  if (!isAuthedContext(auth)) return auth;
  const patch = await req.json();
  try {
    const application = await updateApplication(params.id, patch, scopeFor(auth));
    await recordActivity({
      userId: auth.userId,
      userName: auth.actor,
      action: "update",
      entityType: "application",
      entityId: application.id,
      entityLabel: application.ipoName,
    });
    return NextResponse.json({ application });
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
  const existing = await getApplication(params.id, scopeFor(auth));
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await deleteApplication(params.id, scopeFor(auth));
  await recordActivity({
    userId: auth.userId,
    userName: auth.actor,
    action: "delete",
    entityType: "application",
    entityId: params.id,
    entityLabel: existing.ipoName,
  });
  return NextResponse.json({ ok: true });
}
