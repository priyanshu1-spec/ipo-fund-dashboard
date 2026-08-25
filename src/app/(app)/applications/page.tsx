"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { useSession } from "next-auth/react";
import { Plus, Search, Pencil, Trash2 } from "lucide-react";
import { fetcher, apiRequest } from "@/lib/fetcher";
import { PageHeader } from "@/components/PageHeader";
import { Modal } from "@/components/Modal";
import { StatusBadge } from "@/components/StatusBadge";
import { formatCurrency, formatDate, maskPan, ALLOTMENT_STATUS_COLORS } from "@/lib/utils";
import type { ApplicationRow, AllotmentStatus, ApplicationCategory, IpoRow, InvestorRow } from "@/types";

const CATEGORIES: ApplicationCategory[] = ["Retail", "HNI (sHNI)", "bHNI", "Shareholder", "Employee"];
const ALLOTMENT_OPTIONS: AllotmentStatus[] = ["Pending", "Allotted", "Not Allotted", "Partial"];

const emptyForm: Partial<ApplicationRow> = {
  ipoId: "",
  appliedInNameOf: "",
  investorId: "",
  panMasked: "",
  applicationNumber: "",
  upiId: "",
  category: "Retail",
  lotsApplied: 1,
  amountBlocked: 0,
  paymentMode: "UPI",
  allotmentStatus: "Pending",
  lotsAllotted: 0,
  amountAllotted: 0,
  refundAmount: 0,
  refundStatus: "N/A",
  refundDate: "",
  sellDate: "",
  sellPrice: 0,
  notes: "",
};

export default function ApplicationsPage() {
  const { data: session } = useSession();
  const role = session?.user?.role ?? "viewer";
  const canEdit = role === "editor";
  const canDelete = role === "editor";

  const { data, mutate, isLoading } = useSWR<{ applications: ApplicationRow[] }>("/api/applications", fetcher);
  const { data: iposData } = useSWR<{ ipos: IpoRow[] }>("/api/ipos", fetcher);
  const { data: investorsData } = useSWR<{ investors: InvestorRow[] }>("/api/investors", fetcher);
  const applications = data?.applications ?? [];
  const ipos = iposData?.ipos ?? [];
  const investors = investorsData?.investors ?? [];

  const [search, setSearch] = useState("");
  const [investorFilter, setInvestorFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState<AllotmentStatus | "All">("All");

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ApplicationRow | null>(null);
  const [form, setForm] = useState<Partial<ApplicationRow>>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return applications.filter((a) => {
      if (investorFilter !== "All" && a.investorId !== investorFilter) return false;
      if (statusFilter !== "All" && a.allotmentStatus !== statusFilter) return false;
      if (search) {
        const s = search.toLowerCase();
        if (!a.ipoName.toLowerCase().includes(s) && !a.panMasked.toLowerCase().includes(s)) return false;
      }
      return true;
    });
  }, [applications, investorFilter, statusFilter, search]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setError(null);
    setFormOpen(true);
  }

  function openEdit(app: ApplicationRow) {
    setEditing(app);
    setForm(app);
    setError(null);
    setFormOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const ipo = ipos.find((i) => i.id === form.ipoId);
      const investor = investors.find((inv) => inv.id === form.investorId);
      const payload = {
        ...form,
        ipoName: ipo?.name ?? form.ipoName ?? "",
        appliedInNameOf: form.appliedInNameOf || investor?.name || "",
      };
      if (editing) {
        await apiRequest(`/api/applications/${editing.id}`, "PUT", payload);
      } else {
        await apiRequest("/api/applications", "POST", payload);
      }
      await mutate();
      setFormOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(app: ApplicationRow) {
    if (!confirm(`Delete application for "${app.ipoName}"?`)) return;
    await apiRequest(`/api/applications/${app.id}`, "DELETE");
    await mutate();
  }

  return (
    <div>
      <PageHeader
        title="Applications"
        subtitle="Every bid: who applied, which account, category, amount blocked, and allotment status."
        action={
          canEdit ? (
            <button className="btn-primary" onClick={openCreate}>
              <Plus size={15} /> New Application
            </button>
          ) : undefined
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative">
          <Search size={15} className="absolute left-2.5 top-2.5 text-slate-400" />
          <input
            className="input w-56 pl-8"
            placeholder="Search IPO name or PAN..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select className="input w-48" value={investorFilter} onChange={(e) => setInvestorFilter(e.target.value)}>
          <option value="All">All Demat holders</option>
          {investors.map((inv) => (
            <option key={inv.id} value={inv.id}>
              {inv.name}
            </option>
          ))}
        </select>
        <select className="input w-44" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as AllotmentStatus | "All")}>
          <option value="All">All allotment status</option>
          {ALLOTMENT_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      <div className="card overflow-x-auto p-0">
        <table className="w-full">
          <thead className="border-b border-slate-100 dark:border-slate-800">
            <tr>
              <th className="th">IPO</th>
              <th className="th">Applied In Name Of</th>
              <th className="th">PAN</th>
              <th className="th">Category</th>
              <th className="th">Lots</th>
              <th className="th">Amount Blocked</th>
              <th className="th">Mode</th>
              <th className="th">Allotment</th>
              <th className="th">Refund</th>
              {(canEdit || canDelete) && <th className="th">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={10} className="td py-8 text-center text-slate-400">
                  Loading…
                </td>
              </tr>
            )}
            {!isLoading && filtered.length === 0 && (
              <tr>
                <td colSpan={10} className="td py-8 text-center text-slate-400">
                  No applications match your filters.
                </td>
              </tr>
            )}
            {filtered.map((a) => (
              <tr key={a.id} className="border-t border-slate-100 dark:border-slate-800">
                <td className="td font-medium">{a.ipoName}</td>
                <td className="td">{a.appliedInNameOf}</td>
                <td className="td font-mono text-xs">{maskPan(a.panMasked)}</td>
                <td className="td">{a.category}</td>
                <td className="td">{a.lotsApplied}</td>
                <td className="td">{formatCurrency(a.amountBlocked)}</td>
                <td className="td">{a.paymentMode}</td>
                <td className="td">
                  <StatusBadge status={a.allotmentStatus} colorMap={ALLOTMENT_STATUS_COLORS} />
                </td>
                <td className="td">
                  {a.refundStatus === "N/A" ? "—" : `${a.refundStatus} ${a.refundAmount ? formatCurrency(a.refundAmount) : ""}`}
                </td>
                {(canEdit || canDelete) && (
                  <td className="td">
                    <div className="flex gap-2">
                      {canEdit && (
                        <button onClick={() => openEdit(a)} className="text-slate-400 hover:text-brand-600">
                          <Pencil size={15} />
                        </button>
                      )}
                      {canDelete && (
                        <button onClick={() => handleDelete(a)} className="text-slate-400 hover:text-red-600">
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

      <Modal open={formOpen} onClose={() => setFormOpen(false)} title={editing ? "Edit Application" : "New Application"} wide>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="label">IPO</label>
            <select className="input" required value={form.ipoId ?? ""} onChange={(e) => setForm({ ...form, ipoId: e.target.value })}>
              <option value="">Select IPO…</option>
              {ipos.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name} ({i.type})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Demat Account Holder / Investor</label>
            <select
              className="input"
              required
              value={form.investorId ?? ""}
              onChange={(e) => {
                const inv = investors.find((x) => x.id === e.target.value);
                setForm({ ...form, investorId: e.target.value, appliedInNameOf: inv?.name ?? form.appliedInNameOf, panMasked: inv?.panMasked ?? form.panMasked });
              }}
            >
              <option value="">Select investor…</option>
              {investors.map((inv) => (
                <option key={inv.id} value={inv.id}>
                  {inv.name} ({inv.relationship})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">PAN</label>
            <input className="input font-mono" value={form.panMasked ?? ""} onChange={(e) => setForm({ ...form, panMasked: e.target.value.toUpperCase() })} placeholder="ABCDE1234F" />
          </div>
          <div>
            <label className="label">Application Number</label>
            <input className="input" value={form.applicationNumber ?? ""} onChange={(e) => setForm({ ...form, applicationNumber: e.target.value })} />
          </div>
          <div>
            <label className="label">UPI ID</label>
            <input className="input" value={form.upiId ?? ""} onChange={(e) => setForm({ ...form, upiId: e.target.value })} />
          </div>
          <div>
            <label className="label">Category</label>
            <select className="input" value={form.category ?? "Retail"} onChange={(e) => setForm({ ...form, category: e.target.value as ApplicationCategory })}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Payment Mode</label>
            <select className="input" value={form.paymentMode ?? "UPI"} onChange={(e) => setForm({ ...form, paymentMode: e.target.value as "ASBA" | "UPI" })}>
              <option value="UPI">UPI</option>
              <option value="ASBA">ASBA</option>
            </select>
          </div>
          <div>
            <label className="label">Lots Applied</label>
            <input type="number" className="input" value={form.lotsApplied ?? 0} onChange={(e) => setForm({ ...form, lotsApplied: Number(e.target.value) })} />
          </div>
          <div>
            <label className="label">Amount Blocked (₹)</label>
            <input type="number" className="input" value={form.amountBlocked ?? 0} onChange={(e) => setForm({ ...form, amountBlocked: Number(e.target.value) })} />
          </div>
          <div>
            <label className="label">Allotment Status</label>
            <select className="input" value={form.allotmentStatus ?? "Pending"} onChange={(e) => setForm({ ...form, allotmentStatus: e.target.value as AllotmentStatus })}>
              {ALLOTMENT_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Lots Allotted</label>
            <input type="number" className="input" value={form.lotsAllotted ?? 0} onChange={(e) => setForm({ ...form, lotsAllotted: Number(e.target.value) })} />
          </div>
          <div>
            <label className="label">Amount Allotted (₹)</label>
            <input type="number" className="input" value={form.amountAllotted ?? 0} onChange={(e) => setForm({ ...form, amountAllotted: Number(e.target.value) })} />
          </div>
          <div>
            <label className="label">Refund Status</label>
            <select className="input" value={form.refundStatus ?? "N/A"} onChange={(e) => setForm({ ...form, refundStatus: e.target.value as ApplicationRow["refundStatus"] })}>
              <option value="N/A">N/A</option>
              <option value="Pending">Pending</option>
              <option value="Received">Received</option>
            </select>
          </div>
          <div>
            <label className="label">Refund Amount (₹)</label>
            <input type="number" className="input" value={form.refundAmount ?? 0} onChange={(e) => setForm({ ...form, refundAmount: Number(e.target.value) })} />
          </div>
          <div>
            <label className="label">Refund Date</label>
            <input type="date" className="input" value={form.refundDate ?? ""} onChange={(e) => setForm({ ...form, refundDate: e.target.value })} />
          </div>
          <div>
            <label className="label">Sell Date (if listed & sold)</label>
            <input type="date" className="input" value={form.sellDate ?? ""} onChange={(e) => setForm({ ...form, sellDate: e.target.value })} />
          </div>
          <div>
            <label className="label">Sell Price (₹ per share)</label>
            <input type="number" className="input" value={form.sellPrice ?? 0} onChange={(e) => setForm({ ...form, sellPrice: Number(e.target.value) })} />
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
