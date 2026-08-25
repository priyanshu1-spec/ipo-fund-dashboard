import { NextResponse } from "next/server";
import { z } from "zod";
import { isAuthedContext, requireApiAuth } from "@/lib/apiAuth";
import { createUser, listUsers } from "@/lib/repositories/users";
import { logAudit } from "@/lib/repositories/auditLog";
import type { UserAccountRow } from "@/types";

const createUserSchema = z.object({
  username: z.string().min(3).max(50).regex(/^[a-zA-Z0-9_.-]+$/, "Letters, numbers, _ . - only"),
  password: z.string().min(6),
  role: z.enum(["editor", "viewer"]),
  notes: z.string().optional().default(""),
});

/** Strips the password hash before sending a user account to the client. */
function toPublicUser(u: UserAccountRow) {
  const { passwordHash: _passwordHash, ...rest } = u;
  return rest;
}

// Only editors can view or manage the user list — this is who controls who
// gets into the app at all.
export async function GET() {
  const auth = await requireApiAuth("editor");
  if (!isAuthedContext(auth)) return auth;
  const users = await listUsers();
  return NextResponse.json({ users: users.map(toPublicUser) });
}

export async function POST(req: Request) {
  const auth = await requireApiAuth("editor");
  if (!isAuthedContext(auth)) return auth;

  const body = await req.json();
  const parsed = createUserSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  try {
    const user = await createUser(
      parsed.data.username,
      parsed.data.password,
      parsed.data.role,
      auth.actor,
      parsed.data.notes
    );
    await logAudit(auth.actor, "create", "User", user.id, `${user.username} (${user.role})`);
    return NextResponse.json({ user: toPublicUser(user) }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create user" },
      { status: 400 }
    );
  }
}
