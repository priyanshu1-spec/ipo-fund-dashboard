import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { isAuthedContext, requireApiAuth } from "@/lib/apiAuth";
import { getUserAuthById, setUserPasswordHash } from "@/lib/repositories/users";

/**
 * "My Account" — a logged-in user's own details and self-service password
 * change. Deliberately separate from /api/admin/users/[id]: no minRole here
 * (any authenticated user, viewer through admin), and every operation is
 * scoped to auth.userId — a user can only ever see or change their own row,
 * never anyone else's, with no admin-role branch to get that wrong.
 *
 * The shared-password bootstrap logins ("bootstrap-admin"/"bootstrap-viewer")
 * have no real users-table row, so there's nothing personal to show or a
 * password to change for them — both handlers return a distinct shape the
 * frontend uses to render "you're on the shared login" instead of a form.
 */

function isBootstrapId(id: string): boolean {
  return id === "bootstrap-admin" || id === "bootstrap-viewer";
}

export async function GET() {
  const auth = await requireApiAuth();
  if (!isAuthedContext(auth)) return auth;

  if (isBootstrapId(auth.userId)) {
    return NextResponse.json({ bootstrap: true, name: auth.actor, role: auth.role });
  }

  const user = await getUserAuthById(auth.userId);
  if (!user) return NextResponse.json({ error: "Account not found" }, { status: 404 });
  const { passwordHash: _passwordHash, ...safe } = user;
  return NextResponse.json({ bootstrap: false, ...safe });
}

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Enter your current password"),
  newPassword: z.string().min(8, "New password must be at least 8 characters"),
});

export async function PATCH(req: Request) {
  const auth = await requireApiAuth();
  if (!isAuthedContext(auth)) return auth;

  if (isBootstrapId(auth.userId)) {
    return NextResponse.json(
      { error: "The shared access password is set in Vercel's environment variables, not here." },
      { status: 400 }
    );
  }

  const body = await req.json();
  const parsed = changePasswordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const user = await getUserAuthById(auth.userId);
  if (!user) return NextResponse.json({ error: "Account not found" }, { status: 404 });

  const valid = await bcrypt.compare(parsed.data.currentPassword, user.passwordHash);
  if (!valid) {
    return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(parsed.data.newPassword, 10);
  await setUserPasswordHash(auth.userId, passwordHash);
  return NextResponse.json({ ok: true });
}
