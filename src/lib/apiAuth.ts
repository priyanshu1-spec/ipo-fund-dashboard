import { getServerSession, type Session } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import type { UserRole } from "@/types";

export interface AuthedContext {
  session: Session;
  email: string;
  role: UserRole;
}

/**
 * Guards an API route handler. Returns either an AuthedContext (caller is
 * signed in and, if `minRole` given, meets the minimum role) or a
 * NextResponse to return immediately (401/403).
 */
export async function requireApiAuth(
  minRole?: "viewer" | "editor" | "admin"
): Promise<AuthedContext | NextResponse> {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  if (!session || !email) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const role = (session.user?.role ?? "viewer") as UserRole;
  if (minRole) {
    const rank: Record<UserRole, number> = { viewer: 0, editor: 1, admin: 2 };
    if (rank[role] < rank[minRole]) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }
  }
  return { session, email, role };
}

export function isAuthedContext(x: AuthedContext | NextResponse): x is AuthedContext {
  return !(x instanceof NextResponse);
}
