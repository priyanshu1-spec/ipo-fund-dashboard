"use client";

import { useState } from "react";
import useSWR from "swr";
import { useSession } from "next-auth/react";
import { ShieldOff, UserCheck, UserX, History, Trash2, KeyRound, ShieldAlert, ExternalLink, CalendarOff } from "lucide-react";
import { fetcher, apiRequest } from "@/lib/fetcher";
import { PageHeader } from "@/components/PageHeader";
import { Modal } from "@/components/Modal";
import type { ActivityLogEntry, MarketHolidayRecord, RegistrarRecord, UserAccount, UserAccountStatus, UserRole } from "@/types";

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
      <RegistrarsSection />
      <MarketHolidaysSection />
      <ActivitySection />
    </div>
  );
}

function UsersSection({ selfId }: { selfId?: string }) {
  const { data, mutate, isLoading } = useSWR<{ users: UserAccount[] }>("/api/admin/users", fetcher);
  const users = data?.users ?? [];
  const pending = users.filter((u) => u.status === "pending");
  const [resetPwdUser, setResetPwdUser] = useState<UserAccount | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function setStatus(id: string, status: UserAccountStatus) {
    setActionError(null);
    try {
      await apiRequest(`/api/admin/users/${id}`, "PATCH", { status });
      mutate();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to update status");
      mutate();
    }
  }

  async function setRole(id: string, role: UserRole) {
    setActionError(null);
    try {
      await apiRequest(`/api/admin/users/${id}`, "PATCH", { role });
      mutate();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to update role");
      mutate();
    }
  }

  async function removeUser(id: string, email: string) {
    if (!confirm(`Permanently delete ${email}'s account? This cannot be undone.`)) return;
    setActionError(null);
    try {
      await apiRequest(`/api/admin/users/${id}`, "DELETE");
      mutate();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to delete account");
    }
  }

  return (
    <section>
      {actionError && (
        <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-900/30 dark:text-red-300">
          {actionError}
        </p>
      )}
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
                <td className="td">
                  {u.email}
                  {u.username && <p className="text-xs text-slate-400">@{u.username}</p>}
                </td>
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
                    <button
                      onClick={() => setResetPwdUser(u)}
                      title="Set a new password for this account (e.g. they forgot it)"
                      className="flex items-center gap-1 text-xs font-medium text-slate-500 hover:underline dark:text-slate-400"
                    >
                      <KeyRound size={12} /> Reset password
                    </button>
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

      <ResetPasswordModal user={resetPwdUser} onClose={() => setResetPwdUser(null)} />
    </section>
  );
}

function ResetPasswordModal({ user, onClose }: { user: UserAccount | null; onClose: () => void }) {
  const [newPassword, setNewPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function close() {
    setNewPassword("");
    setError(null);
    setSuccess(false);
    onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    setError(null);
    try {
      await apiRequest(`/api/admin/users/${user.id}`, "PATCH", { newPassword });
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reset password");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={!!user} onClose={close} title={user ? `Reset password — ${user.name}` : "Reset password"}>
      {success ? (
        <div className="space-y-3 text-sm">
          <p className="text-emerald-600">
            Password changed. Share the new password with <strong>{user?.email}</strong> yourself — it
            isn&apos;t emailed automatically.
          </p>
          <button type="button" className="btn-secondary" onClick={close}>
            Done
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Sets a new password for <strong>{user?.email}</strong> directly — for when they&apos;ve
            forgotten theirs. Let them know the new password yourself once it&apos;s set.
          </p>
          <div>
            <label className="label">New password</label>
            <input
              type="password"
              className="input"
              required
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoFocus
            />
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={close}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? "Saving…" : "Reset password"}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}

/**
 * IPO registrar -> allotment-status-URL directory. Never hardcoded in
 * source and never guessed — a registrar shows up here automatically
 * (as unverified) the first time "Refresh IPO Data" sees one this app
 * doesn't already recognize; an admin looks up its real allotment-status
 * page once and saves it here, and every IPO using that registrar (past
 * and future) picks it up immediately, since it's resolved at read time
 * against this table, not stored per-IPO.
 */
function RegistrarsSection() {
  const { data, mutate, isLoading } = useSWR<{ registrars: RegistrarRecord[] }>(
    "/api/admin/registrars",
    fetcher
  );
  const registrars = data?.registrars ?? [];
  const pending = registrars.filter((r) => !r.verified);
  const verified = registrars.filter((r) => r.verified);
  const [editingId, setEditingId] = useState<string | null>(null);

  async function removeRegistrar(id: string, label: string) {
    if (!confirm(`Remove "${label}" from the registrar directory?`)) return;
    await apiRequest(`/api/admin/registrars/${id}`, "DELETE");
    mutate();
  }

  return (
    <section>
      {pending.length > 0 && (
        <div className="mb-4 space-y-2">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200">
            <ShieldAlert size={15} className="text-amber-600" /> New registrars detected ({pending.length})
          </h2>
          {pending.map((r) => (
            <RegistrarRow
              key={r.id}
              registrar={r}
              editing={editingId === r.id}
              onEdit={() => setEditingId(r.id)}
              onCancel={() => setEditingId(null)}
              onSaved={() => {
                setEditingId(null);
                mutate();
              }}
              onRemove={() => removeRegistrar(r.id, r.displayName || r.matchKey)}
              highlight
            />
          ))}
        </div>
      )}

      <h2 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
        IPO registrars ({verified.length} verified)
      </h2>
      <div className="card overflow-x-auto p-0">
        <table className="w-full">
          <thead className="border-b border-slate-100 dark:border-slate-800">
            <tr>
              <th className="th">Registrar</th>
              <th className="th">Allotment URL</th>
              <th className="th">Source</th>
              <th className="th">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={4} className="td py-6 text-center text-slate-400">
                  Loading…
                </td>
              </tr>
            )}
            {!isLoading && verified.length === 0 && (
              <tr>
                <td colSpan={4} className="td py-6 text-center text-slate-400">
                  No verified registrars yet.
                </td>
              </tr>
            )}
            {verified.map((r) => (
              <RegistrarRow
                key={r.id}
                registrar={r}
                editing={editingId === r.id}
                onEdit={() => setEditingId(r.id)}
                onCancel={() => setEditingId(null)}
                onSaved={() => {
                  setEditingId(null);
                  mutate();
                }}
                onRemove={() => removeRegistrar(r.id, r.displayName || r.matchKey)}
                asRow
              />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function RegistrarRow({
  registrar,
  editing,
  onEdit,
  onCancel,
  onSaved,
  onRemove,
  highlight,
  asRow,
}: {
  registrar: RegistrarRecord;
  editing: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSaved: () => void;
  onRemove: () => void;
  /** Renders as a standalone card (the "New registrars detected" list) instead of a table row. */
  highlight?: boolean;
  /** Renders as a <tr> (the main directory table) instead of a card. */
  asRow?: boolean;
}) {
  // If a SEBI RHP/DRHP lookup found a possible domain for this
  // still-pending registrar, pre-fill it as a starting point — never
  // auto-saved, the admin must still confirm/edit and explicitly click
  // "Save & verify" (see ipoProviders/sebiRegistrarLookup.ts).
  const [url, setUrl] = useState(
    registrar.allotmentUrl || (registrar.candidateDomain ? `https://${registrar.candidateDomain}` : "")
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await apiRequest(`/api/admin/registrars/${registrar.id}`, "PATCH", { allotmentUrl: url, verified: true });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  const editForm = (
    <form onSubmit={handleSave} className="flex flex-wrap items-center gap-2">
      <input
        type="url"
        required
        className="input min-w-[16rem] flex-1 py-1 text-xs"
        placeholder="https://... official allotment-status page"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        autoFocus
      />
      <button type="submit" className="btn-primary px-2 py-1 text-xs" disabled={saving}>
        {saving ? "Saving…" : "Save & verify"}
      </button>
      <button type="button" className="btn-secondary px-2 py-1 text-xs" onClick={onCancel}>
        Cancel
      </button>
      {error && <p className="w-full text-xs text-red-600">{error}</p>}
    </form>
  );

  if (highlight) {
    return (
      <div className="card flex flex-wrap items-center justify-between gap-3 border-amber-200 dark:border-amber-900/50">
        <div>
          <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{registrar.displayName}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Seen on a recent IPO — no allotment-status page saved yet.
          </p>
          {registrar.candidateDomain && (
            <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
              Possible domain found in the IPO&apos;s SEBI RHP/DRHP filing: <strong>{registrar.candidateDomain}</strong> —
              unverified, review before saving.
              {registrar.candidateSourceUrl && (
                <>
                  {" "}
                  <a
                    href={registrar.candidateSourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline"
                  >
                    View SEBI filing
                  </a>
                </>
              )}
            </p>
          )}
          {registrar.candidateSnippet && (
            <p className="mt-1 max-w-md text-xs italic text-slate-400" title={registrar.candidateSnippet}>
              &ldquo;{registrar.candidateSnippet.slice(0, 120)}
              {registrar.candidateSnippet.length > 120 ? "…" : ""}&rdquo;
            </p>
          )}
        </div>
        {editing ? (
          editForm
        ) : (
          <div className="flex gap-2">
            <button onClick={onEdit} className="btn-primary px-3 py-1.5 text-xs">
              Add allotment URL
            </button>
            <button onClick={onRemove} className="text-xs font-medium text-red-600 hover:underline">
              Dismiss
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <tr className="border-t border-slate-100 dark:border-slate-800">
      <td className="td font-medium">{registrar.displayName}</td>
      <td className="td">
        {editing ? (
          editForm
        ) : (
          <a
            href={registrar.allotmentUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-brand-600 hover:underline"
          >
            {registrar.allotmentUrl} <ExternalLink size={11} />
          </a>
        )}
      </td>
      <td className="td text-xs capitalize text-slate-500 dark:text-slate-400">{registrar.source}</td>
      <td className="td">
        {!editing && (
          <div className="flex gap-3">
            <button onClick={onEdit} className="text-xs font-medium text-brand-600 hover:underline">
              Edit
            </button>
            <button onClick={onRemove} className="text-xs font-medium text-red-600 hover:underline">
              Remove
            </button>
          </div>
        )}
      </td>
    </tr>
  );
}

/**
 * NSE/BSE trading-holiday calendar. Kept as admin-managed reference data
 * even though nothing currently reads it — it used to feed a blind T+3
 * allotment/listing date *estimate* that has since been removed entirely
 * (this dashboard now only ever shows a date an actual source confirmed,
 * per an explicit product decision). Deliberately empty until an admin
 * adds dates here — this app has no live, verifiable source for the exact
 * yearly holiday list, so it never guesses one.
 */
function MarketHolidaysSection() {
  const { data, mutate, isLoading } = useSWR<{ holidays: MarketHolidayRecord[] }>(
    "/api/admin/market-holidays",
    fetcher
  );
  const holidays = data?.holidays ?? [];
  const [date, setDate] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await apiRequest("/api/admin/market-holidays", "POST", { date, description });
      setDate("");
      setDescription("");
      mutate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add holiday");
    } finally {
      setSaving(false);
    }
  }

  async function removeHoliday(id: string, label: string) {
    if (!confirm(`Remove ${label} from the market-holiday list?`)) return;
    await apiRequest(`/api/admin/market-holidays/${id}`, "DELETE");
    mutate();
  }

  return (
    <section>
      <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200">
        <CalendarOff size={15} /> Market holidays ({holidays.length})
      </h2>
      <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">
        NSE/BSE trading holidays skipped when estimating an IPO&apos;s allotment/listing date. Add each date
        from NSE&apos;s or BSE&apos;s published holiday calendar — nothing is pre-filled or guessed.
      </p>
      <form onSubmit={handleAdd} className="card mb-3 flex flex-wrap items-end gap-2">
        <div>
          <label className="label">Date</label>
          <input
            type="date"
            required
            className="input py-1 text-xs"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <div className="flex-1">
          <label className="label">Description (optional)</label>
          <input
            type="text"
            className="input py-1 text-xs"
            placeholder="e.g. Diwali Laxmi Pujan"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <button type="submit" className="btn-primary px-3 py-1.5 text-xs" disabled={saving}>
          {saving ? "Adding…" : "Add holiday"}
        </button>
        {error && <p className="w-full text-xs text-red-600">{error}</p>}
      </form>
      <div className="card overflow-x-auto p-0">
        <table className="w-full">
          <thead className="border-b border-slate-100 dark:border-slate-800">
            <tr>
              <th className="th">Date</th>
              <th className="th">Description</th>
              <th className="th">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={3} className="td py-6 text-center text-slate-400">
                  Loading…
                </td>
              </tr>
            )}
            {!isLoading && holidays.length === 0 && (
              <tr>
                <td colSpan={3} className="td py-6 text-center text-slate-400">
                  No market holidays added yet — estimates currently skip weekends only.
                </td>
              </tr>
            )}
            {holidays.map((h) => (
              <tr key={h.id} className="border-t border-slate-100 dark:border-slate-800">
                <td className="td font-medium">{new Date(h.date).toLocaleDateString("en-IN")}</td>
                <td className="td text-slate-500 dark:text-slate-400">{h.description || "—"}</td>
                <td className="td">
                  <button
                    onClick={() => removeHoliday(h.id, h.date)}
                    className="text-xs font-medium text-red-600 hover:underline"
                  >
                    Remove
                  </button>
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
