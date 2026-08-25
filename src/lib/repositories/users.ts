import { ensureSchema, sql } from "@/lib/db";
import { generateId } from "@/lib/id";
import { hashPassword } from "@/lib/password";
import type { UserAccountRow, UserRole } from "@/types";

function toUser(r: Record<string, unknown>): UserAccountRow {
  return {
    id: String(r.id ?? ""),
    username: String(r.username ?? ""),
    passwordHash: String(r.password_hash ?? ""),
    role: (r.role as UserRole) || "viewer",
    status: (r.status as UserAccountRow["status"]) || "active",
    createdBy: String(r.created_by ?? ""),
    createdAt: String(r.created_at ?? ""),
    notes: String(r.notes ?? ""),
  };
}

export async function listUsers(): Promise<UserAccountRow[]> {
  await ensureSchema();
  const { rows } = await sql`SELECT * FROM users ORDER BY created_at ASC`;
  return rows.map(toUser);
}

export async function findUserByUsername(username: string): Promise<UserAccountRow | undefined> {
  await ensureSchema();
  const { rows } = await sql`SELECT * FROM users WHERE LOWER(username) = LOWER(${username.trim()}) LIMIT 1`;
  return rows[0] ? toUser(rows[0]) : undefined;
}

export async function getUser(id: string): Promise<UserAccountRow | undefined> {
  await ensureSchema();
  const { rows } = await sql`SELECT * FROM users WHERE id = ${id}`;
  return rows[0] ? toUser(rows[0]) : undefined;
}

export async function createUser(
  username: string,
  password: string,
  role: UserRole,
  createdBy: string,
  notes = ""
): Promise<UserAccountRow> {
  await ensureSchema();
  const existing = await findUserByUsername(username);
  if (existing) throw new Error(`Username "${username}" is already taken`);
  const user: UserAccountRow = {
    id: generateId("user"),
    username: username.trim(),
    passwordHash: hashPassword(password),
    role,
    status: "active",
    createdBy,
    createdAt: new Date().toISOString(),
    notes,
  };
  await sql`
    INSERT INTO users (id, username, password_hash, role, status, created_by, created_at, notes)
    VALUES (${user.id}, ${user.username}, ${user.passwordHash}, ${user.role}, ${user.status}, ${user.createdBy}, ${user.createdAt}, ${user.notes})
  `;
  return user;
}

export async function updateUser(
  id: string,
  patch: Partial<Pick<UserAccountRow, "role" | "status" | "notes">> & { password?: string }
): Promise<UserAccountRow> {
  await ensureSchema();
  const existing = await getUser(id);
  if (!existing) throw new Error(`User ${id} not found`);
  const merged: UserAccountRow = {
    ...existing,
    role: patch.role ?? existing.role,
    status: patch.status ?? existing.status,
    notes: patch.notes ?? existing.notes,
    passwordHash: patch.password ? hashPassword(patch.password) : existing.passwordHash,
  };
  await sql`
    UPDATE users SET
      role = ${merged.role}, status = ${merged.status}, notes = ${merged.notes},
      password_hash = ${merged.passwordHash}
    WHERE id = ${id}
  `;
  return merged;
}

export async function deleteUser(id: string): Promise<void> {
  await ensureSchema();
  await sql`DELETE FROM users WHERE id = ${id}`;
}
