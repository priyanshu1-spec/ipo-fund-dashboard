import { getServerSession, type Session } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import type { UserRole } from "@/types";

export interface AuthedContext {
  session: Session;
  role: UserRole;
  actor: string;
}

const RANK: Record<UserRole, number> = { viewer: 0, editor: 1 };

/**
 * Guards an API route handler server-side — this is the actual security
 * boundary, not just hiding a button in the UI. Returns either an
 * AuthedContext (caller is signed in and, if `minRole` given, meets the
 * minimum role) or a NextResponse to return immediately (401/403).
 */
export async function requireApiAuth(minRole?: UserRole): Promise<AuthedContext | NextResponse> {
  const session = await getServerSession(authOptions);
  const role = session?.user?.role;
  if (!session || !role) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (minRole && RANK[role] < RANK[minRole]) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }
  return { session, role, actor: session.user?.name || role };
}

export function isAuthedContext(x: AuthedContext | NextResponse): x is AuthedContext {
  return !(x instanceof NextResponse);
}
