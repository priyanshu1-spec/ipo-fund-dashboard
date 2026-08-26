"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { useSession } from "next-auth/react";
import { Plus, Search, Pencil, Trash2 } from "lucide-react";
import { fetcher, apiRequest } from "@/lib/fetcher";
import { PageHeader } from "@/components/PageHeader";
import { Modal } from "@/components/Modal";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { ApplicationRow, CapitalSource, FundAllocationRow, InvestorRow } from "@/types";

const emptyForm: Partial<FundAllocationRow> = {
  applicationId: "",
  investorId: "",
  source: "Self",
  amountContributed: 0,
  dateReceived: "",
  repaymentBankAccount: "",
  amountRepaid: 0,
  repaymentDate: "",
  profitShareAmount: 0,
  profitShareStatus: "N/A",
  notes: "",
};

export default function FundsPage() {
  const { data: session } = useSession();
  const role = session?.user?.role ?? "viewer";
  const canEdit = role === "editor";
  const canDelete = role === "editor";

  const { data, mutate, isLoading } = useSWR<{ funds: FundAllocationRow[] }>("/api/funds", fetcher);
  const { data: appsData } = useSWR<{ applications: ApplicationRow[] }>("/api/applications", fetcher);
  const { data: investorsData } = useSWR<{ investors: InvestorRow[] }>("/api/investors", fetcher);
  const funds = data?.funds ?? [];
  const applications = appsData?.applications ?? [];
  const investors = investorsData?.investors ?? [];
  const appById = useMemo(() => new Map(applications.map((a) => [a.id, a])), [applications]);

  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState<CapitalSource | "All">("All");

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<FundAllocationRow | null>(null);
  const [form, setForm] = useState<Partial<FundAllocationRow>>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return funds.filter((f) => {
      if (sourceFilter !== "All" && f.source !== sourceFilter) return false;
      if (search && !f.ipoName.toLowerCase().includes(search.toLowerCase()) && !f.investorName.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [funds, sourceFilter, search]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setError(null);
    setFormOpen(true);
  }

  function openEdit(f: FundAllocationRow) {
    setEditing(f);
    setForm(f);
    setError(null);
    setFormOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const app = appById.get(form.applicationId ?? "");
      const investor = investors.find((i) => i.id === form.investorId);
      const payload = {
        ...form,
        ipoName: app?.ipoName ?? "",
        investorName: investor?.name ?? "",
        repaymentBankAccount: form.repaymentBankAccount || investor?.defaultBankAccount || "",
      };
      if (editing) {
        await apiRequest(`/api/funds/${editing.id}`, "PUT", payload);
      } else {
        await apiRequest("/api/funds", "POST", payload);
      }
      await mutate();
      setFormOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(f: FundAllocationRow) {
    if (!confirm(`Delete this fund allocation for "${f.ipoName}"?`)) return;
    await apiRequest(`/api/funds/${f.id}`, "DELETE");
    await mutate();
  }

  return (
    <div>
      <PageHeader
        title="Fund Ledger"
        subtitle="Who funded each application: self capital vs third-party investor capital, and repayment tracking."
        action={
          canEdit ? (
            <button className="btn-primary" onClick={openCreate}>
              <Plus size={15} /> New Fund Entry
            </button>
          ) : undefined
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative">
          <Search size={15} className="absolute left-2.5 top-2.5 text-slate-400" />
          <input
            className="input w-56 pl-8"
            placeholder="Search IPO or investor..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select className="input w-44" value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value as CapitalSource | "All")}>
          <option value="All">All sources</option>
          <option value="Self">Self</option>
          <option value="Third-Party">Third-Party</option>
        </select>
      </div>

      <div className="card overflow-x-auto p-0">
        <table className="w-full">
          <thead className="border-b border-slate-100 dark:border-slate-800">
            <tr>
              <th className="th">IPO</th>
              <th className="th">Investor</th>
              <th className="th">Source</th>
              <th className="th">Contributed</th>
              <th className="th">Date Received</th>
              <th className="th">Repaid</th>
              <th className="th">Profit Share</th>
              {(canEdit || canDelete) && <th className="th">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={8} className="td py-8 text-center text-slate-400">
                  Loading…
                </td>
              </tr>
            )}
            {!isLoading && filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="td py-8 text-center text-slate-400">
                  No fund allocations match your filters.
                </td>
              </tr>
            )}
            {filtered.map((f) => (
              <tr key={f.id} className="border-t border-slate-100 dark:border-slate-800">
                <td className="td font-medium">{f.ipoName}</td>
                <td className="td">{f.investorName}</td>
                <td className="td">
                  <span className={`badge ${f.source === "Self" ? "bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300" : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"}`}>
                    {f.source}
                  </span>
                </td>
                <td className="td">{formatCurrency(f.amountContributed)}</td>
                <td className="td">{formatDate(f.dateReceived)}</td>
                <td className="td">{formatCurrency(f.amountRepaid)}</td>
                <td className="td">
                  {formatCurrency(f.profitShareAmount)}{" "}
                  {f.profitShareStatus !== "N/A" && (
                    <span className="text-xs text-slate-400">({f.profitShareStatus})</span>
                  )}
                </td>
                {(canEdit || canDelete) && (
                  <td className="td">
                    <div className="flex gap-2">
                      {canEdit && (
                        <button onClick={() => openEdit(f)} className="text-slate-400 hover:text-brand-600">
                          <Pencil size={15} />
                        </button>
                      )}
                      {canDelete && (
                        <button onClick={() => handleDelete(f)} className="text-slate-400 hover:text-red-600">
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={formOpen} onClose={() => setFormOpen(false)} title={editing ? "Edit Fund Entry" : "New Fund Entry"} wide>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="label">Application</label>
            <select className="input" required value={form.applicationId ?? ""} onChange={(e) => setForm({ ...form, applicationId: e.target.value })}>
              <option value="">Select application…</option>
              {applications.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.ipoName} — {a.appliedInNameOf} ({formatCurrency(a.amountBlocked)})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Investor (fund source)</label>
            <select className="input" required value={form.investorId ?? ""} onChange={(e) => setForm({ ...form, investorId: e.target.value })}>
              <option value="">Select investor…</option>
              {investors.map((inv) => (
                <option key={inv.id} value={inv.id}>
                  {inv.name} ({inv.relationship})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Capital Source</label>
            <select className="input" value={form.source ?? "Self"} onChange={(e) => setForm({ ...form, source: e.target.value as CapitalSource })}>
              <option value="Self">My Funds (Self Capital)</option>
              <option value="Third-Party">Third-Party / Investor Funds</option>
            </select>
          </div>
          <div>
            <label className="label">Amount Contributed (₹)</label>
            <input type="number" className="input" value={form.amountContributed ?? 0} onChange={(e) => setForm({ ...form, amountContributed: Number(e.target.value) })} />
          </div>
          <div>
            <label className="label">Date Received</label>
            <input type="date" className="input" value={form.dateReceived ?? ""} onChange={(e) => setForm({ ...form, dateReceived: e.target.value })} />
          </div>
          <div>
            <label className="label">Repayment Bank Account</label>
            <input className="input" value={form.repaymentBankAccount ?? ""} onChange={(e) => setForm({ ...form, repaymentBankAccount: e.target.value })} placeholder="Defaults to investor's saved account" />
          </div>
          <div>
            <label className="label">Amount Repaid (₹)</label>
            <input type="number" className="input" value={form.amountRepaid ?? 0} onChange={(e) => setForm({ ...form, amountRepaid: Number(e.target.value) })} />
          </div>
          <div>
            <label className="label">Repayment Date</label>
            <input type="date" className="input" value={form.repaymentDate ?? ""} onChange={(e) => setForm({ ...form, repaymentDate: e.target.value })} />
          </div>
          <div>
            <label className="label">Profit Share Amount (₹)</label>
            <input type="number" className="input" value={form.profitShareAmount ?? 0} onChange={(e) => setForm({ ...form, profitShareAmount: Number(e.target.value) })} />
          </div>
          <div>
            <label className="label">Profit Share Status</label>
            <select className="input" value={form.profitShareStatus ?? "N/A"} onChange={(e) => setForm({ ...form, profitShareStatus: e.target.value as FundAllocationRow["profitShareStatus"] })}>
              <option value="N/A">N/A</option>
              <option value="Pending">Pending</option>
              <option value="Settled">Settled</option>
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
