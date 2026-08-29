import { getServerSession, type Session } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { touchAndValidate } from "@/lib/repositories/users";
import type { UserAccount, UserRole } from "@/types";

export interface AuthedContext {
  session: Session;
  role: UserRole;
  /** Human-readable name for audit trails (created_by, activity log) — falls back to the role for the legacy shared-password path, which has no real name. */
  actor: string;
  /** Stable id for the activity log and row-level scoping — the DB user id for a real account, or a fixed "bootstrap-admin"/"bootstrap-viewer" for the legacy shared-password path. */
  userId: string;
  /**
   * The full row touchAndValidate() already fetched for a real account (undefined
   * for the bootstrap logins, which have no row). Every route in this app was
   * re-fetching the same user by id right after calling requireApiAuth() —
   * db.ts opens a fresh Postgres connection per query, so that's a full extra
   * round trip for data already sitting in memory. Reuse this instead of
   * calling getUserById/getUserAuthById again for "the current caller's own
   * row" (a route touching a *different* user, e.g. admin/users/[id], still
   * needs its own fetch).
   */
  user?: UserAccount;
}

const RANK: Record<UserRole, number> = { viewer: 0, editor: 1, admin: 2 };

function isBootstrapId(id: string): boolean {
  return id === "bootstrap-admin" || id === "bootstrap-viewer";
}

/**
 * Guards an API route handler server-side — this is the actual security
 * boundary, not just hiding a button in the UI. Returns either an
 * AuthedContext (caller is signed in and, if `minRole` given, meets the
 * minimum role) or a NextResponse to return immediately (401/403).
 *
 * A JWT session token can't be revoked on its own — the token stays valid
 * until it expires regardless of what an admin does in the meantime. So for
 * every real (DB-backed) account, this re-checks the live `users` row on
 * every single request: if an admin suspended, rejected, or deleted the
 * account, or changed its role, that takes effect on this user's *very
 * next* request, not whenever their token happens to expire. The same call
 * also stamps last_active_at, which is what the admin panel's "Last Active"
 * column reads.
 */
export async function requireApiAuth(minRole?: UserRole): Promise<AuthedContext | NextResponse> {
  const session = await getServerSession(authOptions);
  let role = session?.user?.role;
  const userId = session?.user?.id;
  if (!session || !role || !userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let user: UserAccount | undefined;
  if (!isBootstrapId(userId)) {
    const current = await touchAndValidate(userId);
    if (!current || current.status !== "approved") {
      return NextResponse.json({ error: "Account no longer active" }, { status: 401 });
    }
    role = current.role;
    user = current;
  }

  if (minRole && RANK[role] < RANK[minRole]) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }
  return { session, role, actor: session.user?.name || role, userId, user };
}

/**
 * The row-level scope for this request — the actual RLS enforcement point
 * for personal data (applications/funds/investors). `null` means admin:
 * unscoped, sees and can touch every row. Anything else restricts every
 * repository call to exactly that user's own rows, enforced in SQL (see
 * repositories/{applications,funds,investors}.ts) — never left as an
 * app-layer-only check that a route could forget to apply.
 */
export function scopeFor(auth: AuthedContext): string | null {
  return auth.role === "admin" ? null : auth.userId;
}

export function isAuthedContext(x: AuthedContext | NextResponse): x is AuthedContext {
  return !(x instanceof NextResponse);
}
