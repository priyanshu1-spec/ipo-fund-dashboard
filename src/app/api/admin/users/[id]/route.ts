import { NextResponse } from "next/server";
import { z } from "zod";
import { isAuthedContext, requireApiAuth } from "@/lib/apiAuth";
import { deleteUser, getUserById, setUserRole, setUserStatus } from "@/lib/repositories/users";
import { recordActivity } from "@/lib/repositories/activityLog";

const patchSchema = z.object({
  status: z.enum(["pending", "approved", "rejected", "disabled"]).optional(),
  role: z.enum(["viewer", "editor", "admin"]).optional(),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireApiAuth("admin");
  if (!isAuthedContext(auth)) return auth;

  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  if (!parsed.data.status && !parsed.data.role) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }
  // An admin locking themselves out (suspending their own account, or
  // demoting themselves away from admin) is an unrecoverable mistake if
  // they're the only admin — block it outright rather than trying to
  // detect "only admin" at request time.
  if (
    params.id === auth.userId &&
    ((parsed.data.status && parsed.data.status !== "approved") ||
      (parsed.data.role && parsed.data.role !== "admin"))
  ) {
    return NextResponse.json({ error: "You can't revoke your own admin access." }, { status: 400 });
  }

  try {
    let user = await getUserById(params.id);
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    if (parsed.data.status) {
      user = await setUserStatus(params.id, parsed.data.status, auth.actor);
      await recordActivity({
        userId: auth.userId,
        userName: auth.actor,
        action: "update",
        entityType: "user",
        entityId: user.id,
        entityLabel: user.email,
        details: `status -> ${parsed.data.status}`,
      });
    }
    if (parsed.data.role) {
      user = await setUserRole(params.id, parsed.data.role);
      await recordActivity({
        userId: auth.userId,
        userName: auth.actor,
        action: "update",
        entityType: "user",
        entityId: user.id,
        entityLabel: user.email,
        details: `role -> ${parsed.data.role}`,
      });
    }

    return NextResponse.json({ user });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Update failed" },
      { status: 404 }
    );
  }
}

/** Permanently removes the account from the authentication table, killing its session on its very next request (requireApiAuth re-checks the live row every time — see apiAuth.ts). Does not touch any data the user created. */
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireApiAuth("admin");
  if (!isAuthedContext(auth)) return auth;

  if (params.id === auth.userId) {
    return NextResponse.json({ error: "You can't delete your own account." }, { status: 400 });
  }

  const user = await getUserById(params.id);
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  await deleteUser(params.id);
  await recordActivity({
    userId: auth.userId,
    userName: auth.actor,
    action: "delete",
    entityType: "user",
    entityId: params.id,
    entityLabel: user.email,
  });
  return NextResponse.json({ ok: true });
}
