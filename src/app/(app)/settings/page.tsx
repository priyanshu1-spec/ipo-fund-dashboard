"use client";

import { useState } from "react";
import useSWR from "swr";
import { useSession } from "next-auth/react";
import { Plus, ShieldOff, ShieldCheck, Trash2, KeyRound } from "lucide-react";
import { fetcher, apiRequest } from "@/lib/fetcher";
import { PageHeader } from "@/components/PageHeader";
import { Modal } from "@/components/Modal";
import { formatDate } from "@/lib/utils";
import type { AuditLogRow, UserRole } from "@/types";

type PublicUser = {
  id: string;
  username: string;
  role: UserRole;
  status: "active" | "revoked";
  createdBy: string;
  createdAt: string;
  notes?: string;
};

export default function SettingsPage() {
  const { data: session, status } = useSession();
  const role = session?.user?.role;

  if (status === "loading") return <p className="text-sm text-slate-400">Loading…</p>;
  if (role !== "editor") {
    return (
      <div className="card flex items-center gap-3">
        <ShieldOff className="text-red-500" size={20} />
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Only full-access users can manage accounts and view the audit log.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <ManageUsersSection currentUsername={session?.user?.name ?? ""} />
      <AuditLogSection />
    </div>
  );
}

function ManageUsersSection({ currentUsername }: { currentUsername: string }) {
  const { data, mutate, isLoading } = useSWR<{ users: PublicUser[] }>("/api/users", fetcher);
  const users = data?.users ?? [];

  const [formOpen, setFormOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("viewer");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await apiRequest("/api/users", "POST", { username, password, role, notes });
      await mutate();
      setFormOpen(false);
      setUsername("");
      setPassword("");
      setRole("viewer");
      setNotes("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create user");
    } finally {
      setSaving(false);
    }
  }

  async function handleRevoke(u: PublicUser) {
    if (!confirm(`Revoke access for "${u.username}"?`)) return;
    await apiRequest(`/api/users/${u.id}`, "PUT", { status: "revoked" });
    await mutate();
  }

  async function handleReactivate(u: PublicUser) {
    await apiRequest(`/api/users/${u.id}`, "PUT", { status: "active" });
    await mutate();
  }

  async function handleDelete(u: PublicUser) {
    if (!confirm(`Permanently delete the account "${u.username}"? This cannot be undone.`)) return;
    await apiRequest(`/api/users/${u.id}`, "DELETE");
    await mutate();
  }

  async function handleRoleChange(u: PublicUser, newRole: UserRole) {
    await apiRequest(`/api/users/${u.id}`, "PUT", { role: newRole });
    await mutate();
  }

  return (
    <section>
      <PageHeader
        title="Manage Users"
        subtitle="Give each person their own username and password, with full-access or view-only permissions."
        action={
          <button className="btn-primary" onClick={() => setFormOpen(true)}>
            <Plus size={15} /> Add User
          </button>
        }
      />

      <div className="card mb-4 flex items-start gap-3 text-sm text-slate-600 dark:text-slate-300">
        <KeyRound className="mt-0.5 shrink-0 text-brand-600" size={18} />
        <p>
          You (and anyone signed in with the bootstrap admin credentials set in your hosting
          provider&apos;s environment variables) always have full access, even if you revoke or
          delete every account below — so you can never lock yourself out.
        </p>
      </div>

      <div className="card overflow-x-auto p-0">
        <table className="w-full">
          <thead className="border-b border-slate-100 dark:border-slate-800">
            <tr>
              <th className="th">Username</th>
              <th className="th">Role</th>
              <th className="th">Status</th>
              <th className="th">Added By</th>
              <th className="th">Added</th>
              <th className="th">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={6} className="td py-8 text-center text-slate-400">
                  Loading…
                </td>
              </tr>
            )}
            {!isLoading && users.length === 0 && (
              <tr>
                <td colSpan={6} className="td py-8 text-center text-slate-400">
                  No user accounts yet — click &quot;Add User&quot; to create the first one.
                </td>
              </tr>
            )}
            {users.map((u) => (
              <tr key={u.id} className="border-t border-slate-100 dark:border-slate-800">
                <td className="td font-medium">
                  {u.username} {u.username === currentUsername && <span className="text-xs text-slate-400">(you)</span>}
                </td>
                <td className="td">
                  <select
                    className="input !py-1 !text-xs"
                    value={u.role}
                    onChange={(e) => handleRoleChange(u, e.target.value as UserRole)}
                  >
                    <option value="viewer">Viewer</option>
                    <option value="editor">Editor (full access)</option>
                  </select>
                </td>
                <td className="td">
                  <span className={`badge ${u.status === "active" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"}`}>
                    {u.status}
                  </span>
                </td>
                <td className="td">{u.createdBy}</td>
                <td className="td">{formatDate(u.createdAt)}</td>
                <td className="td">
                  <div className="flex gap-2">
                    {u.status === "active" ? (
                      <button onClick={() => handleRevoke(u)} className="text-slate-400 hover:text-red-600" title="Revoke">
                        <ShieldOff size={15} />
                      </button>
                    ) : (
                      <button onClick={() => handleReactivate(u)} className="text-slate-400 hover:text-emerald-600" title="Reactivate">
                        <ShieldCheck size={15} />
                      </button>
                    )}
                    <button onClick={() => handleDelete(u)} className="text-slate-400 hover:text-red-600" title="Delete">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={formOpen} onClose={() => setFormOpen(false)} title="Add User">
        <form onSubmit={handleCreate} className="space-y-3">
          <div>
            <label className="label">Username</label>
            <input className="input" required value={username} onChange={(e) => setUsername(e.target.value)} placeholder="e.g. priya" />
          </div>
          <div>
            <label className="label">Password</label>
            <input
              className="input"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters"
            />
          </div>
          <div>
            <label className="label">Role</label>
            <select className="input" value={role} onChange={(e) => setRole(e.target.value as UserRole)}>
              <option value="viewer">Viewer — read only</option>
              <option value="editor">Editor — can add/edit/delete everything</option>
            </select>
          </div>
          <div>
            <label className="label">Notes</label>
            <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. spouse, CA, etc." />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-secondary" onClick={() => setFormOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? "Creating…" : "Create User"}
            </button>
          </div>
        </form>
      </Modal>
    </section>
  );
}

function AuditLogSection() {
  const { data, isLoading } = useSWR<{ entries: AuditLogRow[] }>("/api/audit", fetcher);
  const entries = data?.entries ?? [];

  return (
    <section>
      <PageHeader title="Audit Log" subtitle="Every create, update, delete and account change, with who did it and when." />
      <div className="card max-h-96 overflow-y-auto p-0">
        <table className="w-full">
          <thead className="sticky top-0 border-b border-slate-100 bg-white dark:border-slate-800 dark:bg-slate-900">
            <tr>
              <th className="th">Time</th>
              <th className="th">User</th>
              <th className="th">Action</th>
              <th className="th">Entity</th>
              <th className="th">Details</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={5} className="td py-8 text-center text-slate-400">
                  Loading…
                </td>
              </tr>
            )}
            {!isLoading && entries.length === 0 && (
              <tr>
                <td colSpan={5} className="td py-8 text-center text-slate-400">
                  No activity logged yet.
                </td>
              </tr>
            )}
            {entries.map((e) => (
              <tr key={e.id} className="border-t border-slate-100 dark:border-slate-800">
                <td className="td whitespace-nowrap">{new Date(e.timestamp).toLocaleString("en-IN")}</td>
                <td className="td">{e.actor}</td>
                <td className="td capitalize">{e.action}</td>
                <td className="td">{e.entityType}</td>
                <td className="td max-w-xs truncate" title={e.details}>
                  {e.details}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
