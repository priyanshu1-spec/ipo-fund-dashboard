"use client";

import useSWR from "swr";
import { useSession } from "next-auth/react";
import { ShieldOff, UserCheck, UserX, History, Trash2 } from "lucide-react";
import { fetcher, apiRequest } from "@/lib/fetcher";
import { PageHeader } from "@/components/PageHeader";
import type { ActivityLogEntry, UserAccount, UserAccountStatus, UserRole } from "@/types";

const STATUS_COLORS: Record<UserAccountStatus, string> = {
  pending: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  approved: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  rejected: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  disabled: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
};

export default function AdminPage() {
  const { data: session, status } = useSession();
  const role = session?.user?.role;

  if (status === "loading") return <p className="text-sm text-slate-400">Loading…</p>;
  if (role !== "admin") {
    return (
      <div className="card flex items-center gap-3">
        <ShieldOff className="text-red-500" size={20} />
        <p className="text-sm text-slate-600 dark:text-slate-300">Only admins can view this page.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Admin"
        subtitle="Approve access requests, manage roles, and review who changed what."
      />
      <UsersSection selfId={session?.user?.id} />
      <ActivitySection />
    </div>
  );
}

function UsersSection({ selfId }: { selfId?: string }) {
  const { data, mutate, isLoading } = useSWR<{ users: UserAccount[] }>("/api/admin/users", fetcher);
  const users = data?.users ?? [];
  const pending = users.filter((u) => u.status === "pending");

  async function setStatus(id: string, status: UserAccountStatus) {
    await apiRequest(`/api/admin/users/${id}`, "PATCH", { status });
    mutate();
  }

  async function setRole(id: string, role: UserRole) {
    await apiRequest(`/api/admin/users/${id}`, "PATCH", { role });
    mutate();
  }

  async function removeUser(id: string, email: string) {
    if (!confirm(`Permanently delete ${email}'s account? This cannot be undone.`)) return;
    await apiRequest(`/api/admin/users/${id}`, "DELETE");
    mutate();
  }

  return (
    <section>
      {pending.length > 0 && (
        <div className="mb-4 space-y-2">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            Pending requests ({pending.length})
          </h2>
          {pending.map((u) => (
            <div
              key={u.id}
              className="card flex flex-wrap items-center justify-between gap-3 border-amber-200 dark:border-amber-900/50"
            >
              <div>
                <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{u.name}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{u.email}</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setStatus(u.id, "approved")}
                  className="flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700"
                >
                  <UserCheck size={14} /> Approve
                </button>
                <button
                  onClick={() => setStatus(u.id, "rejected")}
                  className="flex items-center gap-1 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700"
                >
                  <UserX size={14} /> Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <h2 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">All users</h2>
      <div className="card overflow-x-auto p-0">
        <table className="w-full">
          <thead className="border-b border-slate-100 dark:border-slate-800">
            <tr>
              <th className="th">Name</th>
              <th className="th">Email</th>
              <th className="th">Role</th>
              <th className="th">Status</th>
              <th className="th">Requested</th>
              <th className="th">Last Active</th>
              <th className="th">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={7} className="td py-6 text-center text-slate-400">
                  Loading…
                </td>
              </tr>
            )}
            {!isLoading && users.length === 0 && (
              <tr>
                <td colSpan={7} className="td py-6 text-center text-slate-400">
                  No registered accounts yet.
                </td>
              </tr>
            )}
            {users.map((u) => (
              <tr key={u.id} className="border-t border-slate-100 dark:border-slate-800">
                <td className="td font-medium">{u.name}</td>
                <td className="td">{u.email}</td>
                <td className="td">
                  <select
                    className="input py-1 text-xs"
                    value={u.role}
                    onChange={(e) => setRole(u.id, e.target.value as UserRole)}
                  >
                    <option value="viewer">Viewer</option>
                    <option value="editor">Editor</option>
                    <option value="admin">Admin</option>
                  </select>
                </td>
                <td className="td">
                  <span className={`badge ${STATUS_COLORS[u.status]}`}>{u.status}</span>
                </td>
                <td className="td">{u.createdAt ? new Date(u.createdAt).toLocaleDateString("en-IN") : "—"}</td>
                <td className="td">
                  {u.lastActiveAt ? new Date(u.lastActiveAt).toLocaleString("en-IN") : "Never"}
                </td>
                <td className="td">
                  <div className="flex items-center gap-3">
                    {u.status === "approved" ? (
                      <button
                        onClick={() => setStatus(u.id, "disabled")}
                        className="text-xs font-medium text-red-600 hover:underline"
                      >
                        Disable
                      </button>
                    ) : (
                      <button
                        onClick={() => setStatus(u.id, "approved")}
                        className="text-xs font-medium text-emerald-600 hover:underline"
                      >
                        Approve
                      </button>
                    )}
                    {u.id !== selfId && (
                      <button
                        onClick={() => removeUser(u.id, u.email)}
                        title="Permanently delete this account"
                        className="flex items-center gap-1 text-xs font-medium text-red-600 hover:underline"
                      >
                        <Trash2 size={12} /> Delete
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ActivitySection() {
  const { data, isLoading } = useSWR<{ entries: ActivityLogEntry[] }>("/api/admin/activity", fetcher);
  const entries = data?.entries ?? [];

  return (
    <section>
      <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
        <History size={16} /> Recent activity
      </h2>
      <div className="card max-h-96 overflow-y-auto p-0">
        <table className="w-full">
          <thead className="sticky top-0 border-b border-slate-100 bg-white dark:border-slate-800 dark:bg-slate-900">
            <tr>
              <th className="th">When</th>
              <th className="th">Who</th>
              <th className="th">Action</th>
              <th className="th">Item</th>
              <th className="th">Details</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={5} className="td py-6 text-center text-slate-400">
                  Loading…
                </td>
              </tr>
            )}
            {!isLoading && entries.length === 0 && (
              <tr>
                <td colSpan={5} className="td py-6 text-center text-slate-400">
                  No activity recorded yet.
                </td>
              </tr>
            )}
            {entries.map((e) => (
              <tr key={e.id} className="border-t border-slate-100 dark:border-slate-800">
                <td className="td whitespace-nowrap">{new Date(e.createdAt).toLocaleString("en-IN")}</td>
                <td className="td">{e.userName}</td>
                <td className="td capitalize">{e.action}</td>
                <td className="td">
                  {e.entityType}: {e.entityLabel}
                </td>
                <td className="td text-xs text-slate-500 dark:text-slate-400">{e.details || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
