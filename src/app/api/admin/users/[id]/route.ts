import { NextResponse } from "next/server";
import { z } from "zod";
import { isAuthedContext, requireApiAuth } from "@/lib/apiAuth";
import { getUserById, setUserRole, setUserStatus } from "@/lib/repositories/users";
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
