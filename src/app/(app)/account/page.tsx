"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { KeyRound, Pencil, ShieldCheck, UserCircle } from "lucide-react";
import { fetcher, apiRequest } from "@/lib/fetcher";
import { PageHeader } from "@/components/PageHeader";

interface AccountResponse {
  bootstrap: boolean;
  name: string;
  role: string;
  email?: string;
  status?: string;
  createdAt?: string;
  lastActiveAt?: string;
}

export default function AccountPage() {
  const { data, mutate, isLoading } = useSWR<AccountResponse>("/api/account", fetcher);

  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [nameSaving, setNameSaving] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [nameSaved, setNameSaved] = useState(false);

  useEffect(() => {
    if (data && !data.bootstrap) setNameInput(data.name);
  }, [data]);

  async function handleSaveName(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = nameInput.trim();
    if (!trimmed) return;
    setNameSaving(true);
    setNameError(null);
    try {
      await apiRequest("/api/account", "PATCH", { name: trimmed });
      await mutate();
      setEditingName(false);
      setNameSaved(true);
    } catch (err) {
      setNameError(err instanceof Error ? err.message : "Failed to update name");
    } finally {
      setNameSaving(false);
    }
  }

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    if (newPassword !== confirmPassword) {
      setError("New password and confirmation don't match.");
      return;
    }
    setSaving(true);
    try {
      await apiRequest("/api/account", "PATCH", { currentPassword, newPassword });
      setSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to change password");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader title="My Account" subtitle="Your account details and password." />

      {isLoading && <p className="text-sm text-slate-400">Loading…</p>}

      {data && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="card flex items-start gap-3">
            <UserCircle className="mt-0.5 shrink-0 text-brand-600" size={20} />
            <div className="w-full text-sm text-slate-600 dark:text-slate-300">
              <p className="mb-2 font-semibold text-slate-800 dark:text-slate-100">Account details</p>
              {data.bootstrap ? (
                <p>
                  You&apos;re signed in with the <strong>shared access password</strong> ({data.role}), not
                  a personal account — there are no personal details to show, and this login&apos;s
                  password is set in Vercel&apos;s environment variables, not here. Want a custom name
                  instead of &quot;{data.name}&quot;? Set <code>APP_ACCESS_NAME</code> (or{" "}
                  <code>APP_VIEWER_NAME</code> for the view-only login) in Vercel and redeploy — or, better,
                  register a real personal account at <code>/register</code> so you get your own name,
                  password, and this page&apos;s full details.
                </p>
              ) : (
                <dl className="grid grid-cols-[auto,1fr] gap-x-3 gap-y-1.5">
                  <dt className="text-slate-400">Name</dt>
                  <dd>
                    {editingName ? (
                      <form onSubmit={handleSaveName} className="flex items-center gap-1.5">
                        <input
                          className="input py-1 text-sm"
                          value={nameInput}
                          onChange={(e) => setNameInput(e.target.value)}
                          autoFocus
                          maxLength={200}
                        />
                        <button type="submit" className="btn-primary px-2 py-1 text-xs" disabled={nameSaving}>
                          {nameSaving ? "…" : "Save"}
                        </button>
                        <button
                          type="button"
                          className="btn-secondary px-2 py-1 text-xs"
                          onClick={() => {
                            setEditingName(false);
                            setNameInput(data.name);
                            setNameError(null);
                          }}
                        >
                          Cancel
                        </button>
                      </form>
                    ) : (
                      <span className="flex items-center gap-1.5">
                        {data.name}
                        <button
                          onClick={() => setEditingName(true)}
                          title="Edit your display name"
                          className="text-slate-400 hover:text-brand-600"
                        >
                          <Pencil size={12} />
                        </button>
                      </span>
                    )}
                    {nameError && <p className="mt-1 text-xs text-red-600">{nameError}</p>}
                    {nameSaved && !editingName && (
                      <p className="mt-1 flex items-center gap-1 text-xs text-emerald-600">
                        <ShieldCheck size={11} /> Saved — sign out and back in to see it update everywhere
                        (sidebar, admin panel).
                      </p>
                    )}
                  </dd>
                  <dt className="text-slate-400">Email</dt>
                  <dd>{data.email}</dd>
                  <dt className="text-slate-400">Role</dt>
                  <dd className="capitalize">{data.role}</dd>
                  <dt className="text-slate-400">Status</dt>
                  <dd className="capitalize">{data.status}</dd>
                  <dt className="text-slate-400">Member since</dt>
                  <dd>{data.createdAt ? new Date(data.createdAt).toLocaleDateString("en-IN") : "—"}</dd>
                  <dt className="text-slate-400">Last active</dt>
                  <dd>{data.lastActiveAt ? new Date(data.lastActiveAt).toLocaleString("en-IN") : "—"}</dd>
                </dl>
              )}
            </div>
          </div>

          <div className="card flex items-start gap-3">
            <KeyRound className="mt-0.5 shrink-0 text-fuchsia-600" size={20} />
            <div className="w-full text-sm text-slate-600 dark:text-slate-300">
              <p className="mb-2 font-semibold text-slate-800 dark:text-slate-100">Change password</p>
              {data.bootstrap ? (
                <p>
                  Not applicable to the shared login — change the <code>APP_ACCESS_PASSWORD</code> /{" "}
                  <code>APP_VIEWER_PASSWORD</code> environment variable in Vercel instead, then redeploy.
                </p>
              ) : (
                <form onSubmit={handleChangePassword} className="space-y-2.5">
                  <div>
                    <label className="label">Current password</label>
                    <input
                      type="password"
                      className="input"
                      required
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="label">New password</label>
                    <input
                      type="password"
                      className="input"
                      required
                      minLength={8}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="label">Confirm new password</label>
                    <input
                      type="password"
                      className="input"
                      required
                      minLength={8}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                    />
                  </div>
                  {error && <p className="text-xs text-red-600">{error}</p>}
                  {success && (
                    <p className="flex items-center gap-1 text-xs text-emerald-600">
                      <ShieldCheck size={13} /> Password changed.
                    </p>
                  )}
                  <button type="submit" className="btn-primary" disabled={saving}>
                    {saving ? "Saving…" : "Change password"}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      <p className="mt-4 text-xs text-slate-400">
        Forgot your password and can&apos;t sign in to reach this page? An admin can reset it for you from
        the{" "}
        <a href="/admin" className="text-brand-600 hover:underline">
          Admin panel
        </a>
        .
      </p>
    </div>
  );
}
