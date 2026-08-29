import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { isAuthedContext, requireApiAuth } from "@/lib/apiAuth";
import {
  getUserAuthById,
  getUserByUsername,
  setUserName,
  setUserPasswordHash,
  setUserUsername,
} from "@/lib/repositories/users";

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

  // requireApiAuth() already fetched this exact row (to check status/role)
  // — reusing it here instead of querying again cuts this route from two
  // DB round trips to one; each opens its own fresh Postgres connection
  // (see db.ts), so this was real, measurable latency on every load.
  return NextResponse.json({ bootstrap: false, ...auth.user });
}

// name, username, and the password-change pair are all independent — a
// request can carry any combination. Changing the password still requires
// the current one; changing the name/username does not (neither is
// security-sensitive).
const patchSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    // "" explicitly clears a previously-set username back to unset.
    username: z
      .string()
      .trim()
      .regex(/^[a-zA-Z0-9_]{3,30}$/, "Username must be 3-30 letters, numbers, or underscores")
      .or(z.literal(""))
      .optional(),
    currentPassword: z.string().optional(),
    newPassword: z.string().min(8, "New password must be at least 8 characters").optional(),
  })
  .refine((data) => !data.newPassword || !!data.currentPassword, {
    message: "Enter your current password to change it",
    path: ["currentPassword"],
  });

export async function PATCH(req: Request) {
  const auth = await requireApiAuth();
  if (!isAuthedContext(auth)) return auth;

  if (isBootstrapId(auth.userId)) {
    return NextResponse.json(
      { error: "The shared login has no personal name or password stored here — see Vercel's environment variables." },
      { status: 400 }
    );
  }

  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  if (!parsed.data.name && parsed.data.username == null && !parsed.data.newPassword) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }
  // requireApiAuth() already confirmed this account exists and is approved
  // (a stale/deleted account gets 401'd before this handler even runs), so
  // there's no need to re-fetch it here just to check existence — only the
  // password-change path below needs its own fetch, for the password hash.

  if (parsed.data.name) {
    await setUserName(auth.userId, parsed.data.name);
  }

  if (parsed.data.username != null) {
    if (parsed.data.username) {
      const existing = await getUserByUsername(parsed.data.username);
      if (existing && existing.id !== auth.userId) {
        return NextResponse.json({ error: "That username is already taken." }, { status: 400 });
      }
    }
    await setUserUsername(auth.userId, parsed.data.username);
  }

  if (parsed.data.newPassword) {
    const user = await getUserAuthById(auth.userId);
    if (!user) return NextResponse.json({ error: "Account not found" }, { status: 404 });
    const valid = await bcrypt.compare(parsed.data.currentPassword!, user.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });
    }
    const passwordHash = await bcrypt.hash(parsed.data.newPassword, 10);
    await setUserPasswordHash(auth.userId, passwordHash);
  }

  return NextResponse.json({ ok: true });
}
