"use client";

import { useState } from "react";
import useSWR from "swr";
import { useSession } from "next-auth/react";
import { Plus, ShieldOff, ShieldCheck } from "lucide-react";
import { fetcher, apiRequest } from "@/lib/fetcher";
import { PageHeader } from "@/components/PageHeader";
import { Modal } from "@/components/Modal";
import { formatDate } from "@/lib/utils";
import type { AccessControlRow, AuditLogRow, UserRole } from "@/types";

export default function SettingsPage() {
  const { data: session, status } = useSession();
  const role = session?.user?.role;

  if (status === "loading") return <p className="text-sm text-slate-400">Loading…</p>;
  if (role !== "admin") {
    return (
      <div className="card flex items-center gap-3">
        <ShieldOff className="text-red-500" size={20} />
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Only admins can manage access and view the audit log.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <AccessControlSection />
      <AuditLogSection />
    </div>
  );
}

function AccessControlSection() {
  const { data, mutate, isLoading } = useSWR<{ rows: AccessControlRow[] }>("/api/access", fetcher);
  const rows = data?.rows ?? [];

  const [formOpen, setFormOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<UserRole>("viewer");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGrant(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await apiRequest("/api/access", "POST", { email, role, notes });
      await mutate();
      setFormOpen(false);
      setEmail("");
      setRole("viewer");
      setNotes("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to grant access");
    } finally {
      setSaving(false);
    }
  }

  async function handleRevoke(row: AccessControlRow) {
    if (!confirm(`Revoke access for ${row.email}?`)) return;
    await apiRequest(`/api/access/${row.id}`, "DELETE");
    await mutate();
  }

  async function handleReactivate(row: AccessControlRow) {
    await apiRequest(`/api/access/${row.id}`, "PUT", { status: "active" });
    await mutate();
  }

  async function handleRoleChange(row: AccessControlRow, newRole: UserRole) {
    await apiRequest(`/api/access/${row.id}`, "PUT", { role: newRole });
    await mutate();
  }

  return (
    <section>
      <PageHeader
        title="Access & Permissions"
        subtitle="Control exactly who can open this dashboard, and what they can do (viewer / editor / admin)."
        action={
          <button className="btn-primary" onClick={() => setFormOpen(true)}>
            <Plus size={15} /> Grant Access
          </button>
        }
      />

      <div className="card overflow-x-auto p-0">
        <table className="w-full">
          <thead className="border-b border-slate-100 dark:border-slate-800">
            <tr>
              <th className="th">Email</th>
              <th className="th">Role</th>
              <th className="th">Status</th>
              <th className="th">Added By</th>
              <th className="th">Added At</th>
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
            {!isLoading && rows.length === 0 && (
              <tr>
                <td colSpan={6} className="td py-8 text-center text-slate-400">
                  No one has been granted access yet (besides bootstrap admins in your env config).
                </td>
              </tr>
            )}
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-slate-100 dark:border-slate-800">
                <td className="td font-medium">{row.email}</td>
                <td className="td">
                  <select
                    className="input !py-1 !text-xs"
                    value={row.role}
                    onChange={(e) => handleRoleChange(row, e.target.value as UserRole)}
                  >
                    <option value="viewer">Viewer</option>
                    <option value="editor">Editor</option>
                    <option value="admin">Admin</option>
                  </select>
                </td>
                <td className="td">
                  <span className={`badge ${row.status === "active" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"}`}>
                    {row.status}
                  </span>
                </td>
                <td className="td">{row.addedBy}</td>
                <td className="td">{formatDate(row.addedAt)}</td>
                <td className="td">
                  <div className="flex gap-2">
                    {row.status === "active" ? (
                      <button onClick={() => handleRevoke(row)} className="text-slate-400 hover:text-red-600" title="Revoke">
                        <ShieldOff size={15} />
                      </button>
                    ) : (
                      <button onClick={() => handleReactivate(row)} className="text-slate-400 hover:text-emerald-600" title="Reactivate">
                        <ShieldCheck size={15} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={formOpen} onClose={() => setFormOpen(false)} title="Grant Access">
        <form onSubmit={handleGrant} className="space-y-3">
          <div>
            <label className="label">Google account email</label>
            <input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="person@gmail.com" />
          </div>
          <div>
            <label className="label">Role</label>
            <select className="input" value={role} onChange={(e) => setRole(e.target.value as UserRole)}>
              <option value="viewer">Viewer — read only</option>
              <option value="editor">Editor — can add/edit records</option>
              <option value="admin">Admin — full control incl. access management</option>
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
              {saving ? "Saving…" : "Grant Access"}
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
      <PageHeader title="Audit Log" subtitle="Every create, update, delete and access change, with who did it and when." />
      <div className="card max-h-96 overflow-y-auto p-0">
        <table className="w-full">
          <thead className="sticky top-0 border-b border-slate-100 bg-white dark:border-slate-800 dark:bg-slate-900">
            <tr>
              <th className="th">Time</th>
              <th className="th">Actor</th>
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
                <td className="td">{e.actorEmail}</td>
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
