import { NextResponse } from "next/server";
import { isAuthedContext, requireApiAuth } from "@/lib/apiAuth";
import { deleteUser, updateUser } from "@/lib/repositories/users";
import { logAudit } from "@/lib/repositories/auditLog";
import type { UserAccountRow } from "@/types";

function toPublicUser(u: UserAccountRow) {
  const { passwordHash: _passwordHash, ...rest } = u;
  return rest;
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireApiAuth("editor");
  if (!isAuthedContext(auth)) return auth;
  const patch = await req.json();
  try {
    const user = await updateUser(params.id, patch);
    await logAudit(auth.actor, "update", "User", user.id, `${user.username} (${user.role}, ${user.status})`);
    return NextResponse.json({ user: toPublicUser(user) });
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
  await deleteUser(params.id);
  await logAudit(auth.actor, "delete", "User", params.id, "");
  return NextResponse.json({ ok: true });
}
