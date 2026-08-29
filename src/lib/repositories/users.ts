import { ensureSchema, sql } from "@/lib/db";
import { generateId } from "@/lib/id";
import type { UserAccount, UserAccountStatus, UserRole } from "@/types";

function toUser(r: Record<string, unknown>): UserAccount {
  return {
    id: String(r.id ?? ""),
    email: String(r.email ?? ""),
    username: String(r.username ?? ""),
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

/** Used only to check uniqueness before setting/changing a username (registration, self-service edit) — never for login (see getUserAuthByUsername for that). */
export async function getUserByUsername(username: string): Promise<UserAccount | undefined> {
  await ensureSchema();
  const { rows } = await sql`SELECT * FROM users WHERE lower(username) = ${username.toLowerCase()}`;
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

/** Same as getUserAuthByEmail but by username — the sign-in form accepts either; auth.ts picks this one when the entered value doesn't look like an email (no "@"). Never return this to the client. */
export async function getUserAuthByUsername(
  username: string
): Promise<(UserAccount & { passwordHash: string }) | undefined> {
  await ensureSchema();
  const { rows } = await sql`SELECT * FROM users WHERE lower(username) = ${username.toLowerCase()}`;
  if (!rows[0]) return undefined;
  return { ...toUser(rows[0]), passwordHash: String(rows[0].password_hash ?? "") };
}

/** Same as getUserAuthByEmail but by id — needed for a logged-in user changing their own password, where we already have their id from the session and don't want to round-trip through their email. Never return this to the client. */
export async function getUserAuthById(
  id: string
): Promise<(UserAccount & { passwordHash: string }) | undefined> {
  await ensureSchema();
  const { rows } = await sql`SELECT * FROM users WHERE id = ${id}`;
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
  /** Optional — an alternate login handle alongside email. Omit or leave blank if not wanted. */
  username?: string;
}): Promise<UserAccount> {
  await ensureSchema();
  const existing = await getUserByEmail(input.email);
  if (existing) throw new Error("An account with that email already exists.");
  const username = input.username?.trim() || "";
  if (username) {
    const existingUsername = await getUserByUsername(username);
    if (existingUsername) throw new Error("That username is already taken.");
  }
  const id = generateId("user");
  const now = new Date().toISOString();
  await sql`
    INSERT INTO users (id, email, username, password_hash, name, role, status, created_at, approved_at, approved_by, last_active_at)
    VALUES (${id}, ${input.email.toLowerCase()}, ${username || null}, ${input.passwordHash}, ${input.name}, 'viewer', 'pending', ${now}, '', '', '')
  `;
  return {
    id,
    email: input.email.toLowerCase(),
    username,
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

export async function setUserName(id: string, name: string): Promise<UserAccount> {
  await ensureSchema();
  const { rows } = await sql`UPDATE users SET name = ${name} WHERE id = ${id} RETURNING *`;
  if (!rows[0]) throw new Error(`User ${id} not found`);
  return toUser(rows[0]);
}

/** Pass "" to clear a username back to unset. Caller (the API route) is responsible for the uniqueness check via getUserByUsername first — this just writes. */
export async function setUserUsername(id: string, username: string): Promise<UserAccount> {
  await ensureSchema();
  const { rows } = await sql`UPDATE users SET username = ${username || null} WHERE id = ${id} RETURNING *`;
  if (!rows[0]) throw new Error(`User ${id} not found`);
  return toUser(rows[0]);
}

export async function setUserRole(id: string, role: UserRole): Promise<UserAccount> {
  await ensureSchema();
  const { rows } = await sql`UPDATE users SET role = ${role} WHERE id = ${id} RETURNING *`;
  if (!rows[0]) throw new Error(`User ${id} not found`);
  return toUser(rows[0]);
}

/** Takes an already-hashed password — never a plaintext one. Used by both an admin resetting someone else's forgotten password and a user changing their own. */
export async function setUserPasswordHash(id: string, passwordHash: string): Promise<UserAccount> {
  await ensureSchema();
  const { rows } = await sql`UPDATE users SET password_hash = ${passwordHash} WHERE id = ${id} RETURNING *`;
  if (!rows[0]) throw new Error(`User ${id} not found`);
  return toUser(rows[0]);
}

/** Permanently removes the account from the authentication table. Does NOT touch any data the user created (applications/funds/investors) — those rows keep their owner_id and remain intact, just no longer reachable by anyone but an admin (see scopeFor() in apiAuth.ts) since no live account holds that id anymore. */
export async function deleteUser(id: string): Promise<void> {
  await ensureSchema();
  await sql`DELETE FROM users WHERE id = ${id}`;
}
