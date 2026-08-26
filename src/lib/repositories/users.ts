import { ensureSchema, sql } from "@/lib/db";
import { generateId } from "@/lib/id";
import type { UserAccount, UserAccountStatus, UserRole } from "@/types";

function toUser(r: Record<string, unknown>): UserAccount {
  return {
    id: String(r.id ?? ""),
    email: String(r.email ?? ""),
    name: String(r.name ?? ""),
    role: (r.role as UserRole) || "viewer",
    status: (r.status as UserAccountStatus) || "pending",
    createdAt: String(r.created_at ?? ""),
    approvedAt: String(r.approved_at ?? ""),
    approvedBy: String(r.approved_by ?? ""),
    lastActiveAt: String(r.last_active_at ?? ""),
  };
}

export async function listUsers(): Promise<UserAccount[]> {
  await ensureSchema();
  const { rows } = await sql`SELECT * FROM users ORDER BY created_at DESC`;
  return rows.map(toUser);
}

export async function getUserById(id: string): Promise<UserAccount | undefined> {
  await ensureSchema();
  const { rows } = await sql`SELECT * FROM users WHERE id = ${id}`;
  return rows[0] ? toUser(rows[0]) : undefined;
}

export async function getUserByEmail(email: string): Promise<UserAccount | undefined> {
  await ensureSchema();
  const { rows } = await sql`SELECT * FROM users WHERE lower(email) = ${email.toLowerCase()}`;
  return rows[0] ? toUser(rows[0]) : undefined;
}

/** Internal — includes the password hash, needed only by the login check. Never return this to the client. */
export async function getUserAuthByEmail(
  email: string
): Promise<(UserAccount & { passwordHash: string }) | undefined> {
  await ensureSchema();
  const { rows } = await sql`SELECT * FROM users WHERE lower(email) = ${email.toLowerCase()}`;
  if (!rows[0]) return undefined;
  return { ...toUser(rows[0]), passwordHash: String(rows[0].password_hash ?? "") };
}

/**
 * Called once per authenticated API request (see apiAuth.ts) for every
 * real account — this is the actual revocation mechanism, since a JWT
 * session can't otherwise be invalidated early. Stamps last_active_at and
 * returns the row's current status/role in the same round trip, so a
 * suspend/role-change/delete an admin just made is visible on this user's
 * very next request rather than whenever their token happens to expire.
 * Returns undefined if the account no longer exists (deleted).
 */
export async function touchAndValidate(id: string): Promise<UserAccount | undefined> {
  await ensureSchema();
  const now = new Date().toISOString();
  const { rows } = await sql`
    UPDATE users SET last_active_at = ${now} WHERE id = ${id} RETURNING *
  `;
  return rows[0] ? toUser(rows[0]) : undefined;
}

export async function createUser(input: {
  email: string;
  passwordHash: string;
  name: string;
}): Promise<UserAccount> {
  await ensureSchema();
  const existing = await getUserByEmail(input.email);
  if (existing) throw new Error("An account with that email already exists.");
  const id = generateId("user");
  const now = new Date().toISOString();
  await sql`
    INSERT INTO users (id, email, password_hash, name, role, status, created_at, approved_at, approved_by, last_active_at)
    VALUES (${id}, ${input.email.toLowerCase()}, ${input.passwordHash}, ${input.name}, 'viewer', 'pending', ${now}, '', '', '')
  `;
  return {
    id,
    email: input.email.toLowerCase(),
    name: input.name,
    role: "viewer",
    status: "pending",
    createdAt: now,
    approvedAt: "",
    approvedBy: "",
    lastActiveAt: "",
  };
}

export async function setUserStatus(
  id: string,
  status: UserAccountStatus,
  approvedBy: string
): Promise<UserAccount> {
  await ensureSchema();
  const now = new Date().toISOString();
  const { rows } = await sql`
    UPDATE users SET status = ${status}, approved_at = ${now}, approved_by = ${approvedBy}
    WHERE id = ${id}
    RETURNING *
  `;
  if (!rows[0]) throw new Error(`User ${id} not found`);
  return toUser(rows[0]);
}

export async function setUserRole(id: string, role: UserRole): Promise<UserAccount> {
  await ensureSchema();
  const { rows } = await sql`UPDATE users SET role = ${role} WHERE id = ${id} RETURNING *`;
  if (!rows[0]) throw new Error(`User ${id} not found`);
  return toUser(rows[0]);
}

/** Permanently removes the account from the authentication table. Does NOT touch any data the user created (applications/funds/investors) — those rows keep their owner_id and remain intact, just no longer reachable by anyone but an admin (see scopeFor() in apiAuth.ts) since no live account holds that id anymore. */
export async function deleteUser(id: string): Promise<void> {
  await ensureSchema();
  await sql`DELETE FROM users WHERE id = ${id}`;
}
