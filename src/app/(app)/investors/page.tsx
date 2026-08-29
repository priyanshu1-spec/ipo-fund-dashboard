"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { useSession } from "next-auth/react";
import { Plus, Search, Pencil, Trash2 } from "lucide-react";
import { fetcher, apiRequest } from "@/lib/fetcher";
import { PageHeader } from "@/components/PageHeader";
import { Modal } from "@/components/Modal";
import { formatCurrency } from "@/lib/utils";
import type { DashboardSummary, InvestorRow } from "@/types";

const emptyForm: Partial<InvestorRow> = {
  name: "",
  relationship: "",
  phone: "",
  email: "",
  defaultBankAccount: "",
  defaultBankIfsc: "",
  demandAccountNumber: "",
  panMasked: "",
  status: "Active",
  notes: "",
};

export default function InvestorsPage() {
  const { data: session } = useSession();
  const role = session?.user?.role ?? "viewer";
  const canEdit = role === "editor" || role === "admin";
  const canDelete = role === "editor" || role === "admin";

  const { data, mutate, isLoading } = useSWR<{ investors: InvestorRow[] }>("/api/investors", fetcher);
  const { data: summaryData } = useSWR<{ summary: DashboardSummary }>("/api/dashboard/summary", fetcher);
  const investors = data?.investors ?? [];
  const ledgerByInvestor = useMemo(
    () => new Map((summaryData?.summary.investorLedgers ?? []).map((l) => [l.investorId, l])),
    [summaryData]
  );

  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<InvestorRow | null>(null);
  const [form, setForm] = useState<Partial<InvestorRow>>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const filtered = investors.filter((i) => !search || i.name.toLowerCase().includes(search.toLowerCase()));

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setError(null);
    setFormOpen(true);
  }

  function openEdit(inv: InvestorRow) {
    setEditing(inv);
    setForm(inv);
    setError(null);
    setFormOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (editing) {
        await apiRequest(`/api/investors/${editing.id}`, "PUT", form);
      } else {
        await apiRequest("/api/investors", "POST", form);
      }
      await mutate();
      setFormOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(inv: InvestorRow) {
    if (!confirm(`Delete investor "${inv.name}"? Existing applications/funds referencing them will keep their name but lose the link.`)) return;
    setDeleteError(null);
    try {
      await apiRequest(`/api/investors/${inv.id}`, "DELETE");
      await mutate();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Failed to delete");
    }
  }

  return (
    <div>
      <PageHeader
        title="Investors"
        subtitle="Everyone whose Demat/bank account is used, or who has contributed capital — with a live ledger."
        action={
          canEdit ? (
            <button className="btn-primary" onClick={openCreate}>
              <Plus size={15} /> Add Investor
            </button>
          ) : undefined
        }
      />

      {deleteError && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">
          {deleteError}
        </p>
      )}

      <div className="mb-4 relative w-64">
        <Search size={15} className="absolute left-2.5 top-2.5 text-slate-400" />
        <input className="input pl-8" placeholder="Search investors..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {isLoading && <p className="text-sm text-slate-400">Loading…</p>}
        {!isLoading && filtered.length === 0 && <p className="text-sm text-slate-400">No investors yet.</p>}
        {filtered.map((inv) => {
          const ledger = ledgerByInvestor.get(inv.id);
          return (
            <div key={inv.id} className="card">
              <div className="mb-2 flex items-start justify-between">
                <div>
                  <p className="font-semibold text-slate-900 dark:text-white">{inv.name}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{inv.relationship || "—"}</p>
                </div>
                <span className={`badge ${inv.status === "Active" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" : "bg-slate-100 text-slate-500"}`}>
                  {inv.status}
                </span>
              </div>
              <dl className="space-y-1 text-xs text-slate-500 dark:text-slate-400">
                {inv.phone && <div>📞 {inv.phone}</div>}
                {inv.email && <div>✉️ {inv.email}</div>}
                {inv.defaultBankAccount && (
                  <div>
                    🏦 {inv.defaultBankAccount} {inv.defaultBankIfsc && `(${inv.defaultBankIfsc})`}
                  </div>
                )}
              </dl>
              {ledger && (
                <div className="mt-3 grid grid-cols-2 gap-2 border-t border-slate-100 pt-3 text-xs dark:border-slate-800">
                  <div>
                    <p className="text-slate-400">Provided</p>
                    <p className="font-semibold text-slate-800 dark:text-slate-100">{formatCurrency(ledger.totalProvided)}</p>
                  </div>
                  <div>
                    <p className="text-slate-400">Outstanding</p>
                    <p className="font-semibold text-slate-800 dark:text-slate-100">{formatCurrency(ledger.outstandingToRepay)}</p>
                  </div>
                  <div>
                    <p className="text-slate-400">Allotment Value</p>
                    <p className="font-semibold text-slate-800 dark:text-slate-100">{formatCurrency(ledger.totalAllotmentValue)}</p>
                  </div>
                  <div>
                    <p className="text-slate-400">Profit Share</p>
                    <p className="font-semibold text-slate-800 dark:text-slate-100">{formatCurrency(ledger.netProfitShare)}</p>
                  </div>
                </div>
              )}
              {(canEdit || canDelete) && (
                <div className="mt-3 flex justify-end gap-2 border-t border-slate-100 pt-2 dark:border-slate-800">
                  {canEdit && (
                    <button onClick={() => openEdit(inv)} className="text-slate-400 hover:text-brand-600">
                      <Pencil size={15} />
                    </button>
                  )}
                  {canDelete && (
                    <button onClick={() => handleDelete(inv)} className="text-slate-400 hover:text-red-600">
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <Modal open={formOpen} onClose={() => setFormOpen(false)} title={editing ? "Edit Investor" : "Add Investor"} wide>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="label">Name</label>
            <input className="input" required value={form.name ?? ""} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label className="label">Relationship</label>
            <input className="input" value={form.relationship ?? ""} onChange={(e) => setForm({ ...form, relationship: e.target.value })} placeholder="Self / Spouse / Parent / Client A" />
          </div>
          <div>
            <label className="label">Phone</label>
            <input className="input" value={form.phone ?? ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div>
            <label className="label">Email</label>
            <input className="input" type="email" value={form.email ?? ""} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div>
            <label className="label">Default Bank Account</label>
            <input className="input" value={form.defaultBankAccount ?? ""} onChange={(e) => setForm({ ...form, defaultBankAccount: e.target.value })} />
          </div>
          <div>
            <label className="label">IFSC</label>
            <input className="input" value={form.defaultBankIfsc ?? ""} onChange={(e) => setForm({ ...form, defaultBankIfsc: e.target.value })} />
          </div>
          <div>
            <label className="label">Demat Account Number</label>
            <input className="input" value={form.demandAccountNumber ?? ""} onChange={(e) => setForm({ ...form, demandAccountNumber: e.target.value })} />
          </div>
          <div>
            <label className="label">PAN</label>
            <input className="input font-mono" value={form.panMasked ?? ""} onChange={(e) => setForm({ ...form, panMasked: e.target.value.toUpperCase() })} />
          </div>
          <div>
            <label className="label">Status</label>
            <select className="input" value={form.status ?? "Active"} onChange={(e) => setForm({ ...form, status: e.target.value as InvestorRow["status"] })}>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="label">Notes</label>
            <textarea className="input" rows={2} value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>

          {error && <p className="sm:col-span-2 text-sm text-red-600">{error}</p>}

          <div className="sm:col-span-2 mt-2 flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={() => setFormOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
