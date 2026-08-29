"use client";

import { useState } from "react";
import useSWR from "swr";
import { HelpCircle, KeyRound, Pencil, ShieldCheck, UserCircle } from "lucide-react";
import { fetcher, apiRequest } from "@/lib/fetcher";
import { PageHeader } from "@/components/PageHeader";
import { SECURITY_QUESTION_CUSTOM, SECURITY_QUESTION_PRESETS } from "@/lib/securityQuestions";

interface AccountResponse {
  bootstrap: boolean;
  name: string;
  username: string;
  securityQuestion: string;
  role: string;
  email?: string;
  status?: string;
  createdAt?: string;
  lastActiveAt?: string;
}

/**
 * One editable field on the Account details list — pencil turns it into an
 * input + Save/Cancel. Shared by Name and Username so neither duplicates
 * the same open/save/error state machine.
 */
function EditableField({
  label,
  value,
  placeholder,
  field,
  onSaved,
  emptyText,
}: {
  label: string;
  value: string;
  placeholder?: string;
  field: "name" | "username";
  onSaved: () => Promise<unknown>;
  /** Shown instead of a blank value when unset — only makes sense for username, which is optional. */
  emptyText?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [input, setInput] = useState(value);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = input.trim();
    if (field === "name" && !trimmed) return;
    setSaving(true);
    setError(null);
    try {
      await apiRequest("/api/account", "PATCH", { [field]: trimmed });
      await onSaved();
      setEditing(false);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to update ${label.toLowerCase()}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <dt className="text-slate-400">{label}</dt>
      <dd>
        {editing ? (
          <form onSubmit={handleSave} className="flex items-center gap-1.5">
            <input
              className="input py-1 text-sm"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={placeholder}
              autoFocus
              maxLength={field === "name" ? 200 : 30}
            />
            <button type="submit" className="btn-primary px-2 py-1 text-xs" disabled={saving}>
              {saving ? "…" : "Save"}
            </button>
            <button
              type="button"
              className="btn-secondary px-2 py-1 text-xs"
              onClick={() => {
                setEditing(false);
                setInput(value);
                setError(null);
              }}
            >
              Cancel
            </button>
          </form>
        ) : (
          <span className="flex items-center gap-1.5">
            {value || <span className="italic text-slate-400">{emptyText ?? "—"}</span>}
            <button
              onClick={() => setEditing(true)}
              title={`Edit your ${label.toLowerCase()}`}
              className="text-slate-400 hover:text-brand-600"
            >
              <Pencil size={12} />
            </button>
          </span>
        )}
        {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
        {saved && !editing && (
          <p className="mt-1 flex items-center gap-1 text-xs text-emerald-600">
            <ShieldCheck size={11} /> Saved — sign out and back in to see it update everywhere (sidebar,
            admin panel).
          </p>
        )}
      </dd>
    </>
  );
}

function SecurityQuestionCard({
  currentQuestion,
  onSaved,
}: {
  currentQuestion: string;
  onSaved: () => Promise<unknown>;
}) {
  const [editing, setEditing] = useState(false);
  const [questionChoice, setQuestionChoice] = useState("");
  const [customQuestion, setCustomQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const isPreset = (SECURITY_QUESTION_PRESETS as readonly string[]).includes(currentQuestion);
  const question = questionChoice === SECURITY_QUESTION_CUSTOM ? customQuestion : questionChoice;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!question.trim() || !answer.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await apiRequest("/api/account", "PATCH", { securityQuestion: question.trim(), securityAnswer: answer });
      await onSaved();
      setEditing(false);
      setSaved(true);
      setAnswer("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card mt-4 flex items-start gap-3">
      <HelpCircle className="mt-0.5 shrink-0 text-amber-600" size={20} />
      <div className="w-full text-sm text-slate-600 dark:text-slate-300">
        <p className="mb-2 font-semibold text-slate-800 dark:text-slate-100">Security question</p>
        <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">
          Used to reset your password without an admin, at{" "}
          <a href="/forgot-password" className="text-brand-600 hover:underline">
            /forgot-password
          </a>
          .
        </p>
        {!editing ? (
          <div className="flex items-center gap-1.5">
            {currentQuestion ? (
              <span>{currentQuestion}</span>
            ) : (
              <span className="italic text-slate-400">Not set</span>
            )}
            <button
              onClick={() => {
                setQuestionChoice(isPreset ? currentQuestion : currentQuestion ? SECURITY_QUESTION_CUSTOM : "");
                setCustomQuestion(isPreset ? "" : currentQuestion);
                setEditing(true);
                setSaved(false);
              }}
              title={currentQuestion ? "Change your security question" : "Set a security question"}
              className="text-slate-400 hover:text-brand-600"
            >
              <Pencil size={12} />
            </button>
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-2.5">
            <div>
              <label className="label">Question</label>
              <select
                className="input"
                value={questionChoice}
                onChange={(e) => setQuestionChoice(e.target.value)}
              >
                <option value="">Choose a question…</option>
                {SECURITY_QUESTION_PRESETS.map((q) => (
                  <option key={q} value={q}>
                    {q}
                  </option>
                ))}
                <option value={SECURITY_QUESTION_CUSTOM}>Write my own question…</option>
              </select>
            </div>
            {questionChoice === SECURITY_QUESTION_CUSTOM && (
              <input
                type="text"
                className="input"
                value={customQuestion}
                onChange={(e) => setCustomQuestion(e.target.value)}
                placeholder="e.g. What street did you grow up on?"
              />
            )}
            {questionChoice && (
              <div>
                <label className="label">Answer</label>
                <input
                  type="text"
                  className="input"
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  placeholder={currentQuestion ? "Enter a new answer" : "Answer isn't case-sensitive"}
                />
              </div>
            )}
            {error && <p className="text-xs text-red-600">{error}</p>}
            <div className="flex gap-2">
              <button type="submit" className="btn-primary px-3 py-1.5 text-xs" disabled={saving || !question || !answer}>
                {saving ? "Saving…" : "Save"}
              </button>
              <button
                type="button"
                className="btn-secondary px-3 py-1.5 text-xs"
                onClick={() => {
                  setEditing(false);
                  setError(null);
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        )}
        {saved && !editing && (
          <p className="mt-1.5 flex items-center gap-1 text-xs text-emerald-600">
            <ShieldCheck size={11} /> Saved.
          </p>
        )}
      </div>
    </div>
  );
}

export default function AccountPage() {
  const { data, mutate, isLoading } = useSWR<AccountResponse>("/api/account", fetcher);

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
                  username, password, and this page&apos;s full details.
                </p>
              ) : (
                <dl className="grid grid-cols-[auto,1fr] gap-x-3 gap-y-1.5">
                  <EditableField label="Name" value={data.name} field="name" onSaved={() => mutate()} />
                  <EditableField
                    label="Username"
                    value={data.username}
                    field="username"
                    placeholder="letters, numbers, underscore"
                    emptyText="Not set — sign in with email only"
                    onSaved={() => mutate()}
                  />
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

      {data && !data.bootstrap && (
        <SecurityQuestionCard currentQuestion={data.securityQuestion} onSaved={() => mutate()} />
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
