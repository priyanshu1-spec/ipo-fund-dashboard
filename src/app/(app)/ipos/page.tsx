"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { useSession } from "next-auth/react";
import { Plus, RefreshCw, Search, Upload, Pencil, Trash2 } from "lucide-react";
import { fetcher, apiRequest } from "@/lib/fetcher";
import { PageHeader } from "@/components/PageHeader";
import { Modal } from "@/components/Modal";
import { StatusBadge } from "@/components/StatusBadge";
import { formatDate, IPO_STATUS_COLORS } from "@/lib/utils";
import type { IpoRow, IpoStatus, IpoType } from "@/types";

const STATUS_OPTIONS: (IpoStatus | "All")[] = [
  "All",
  "Upcoming",
  "Open",
  "Closed",
  "Allotment Awaited",
  "Allotted",
  "Listed",
];

const emptyForm: Partial<IpoRow> = {
  name: "",
  type: "Mainboard",
  openDate: "",
  closeDate: "",
  allotmentDate: "",
  refundDate: "",
  listingDate: "",
  priceBandMin: 0,
  priceBandMax: 0,
  lotSize: 0,
  issueSize: "",
  status: "Upcoming",
  gmp: 0,
  exchange: "",
  sourceUrl: "",
  notes: "",
};

export default function IposPage() {
  const { data: session } = useSession();
  const role = session?.user?.role ?? "viewer";
  const canEdit = role === "editor";
  const canDelete = role === "editor";

  const { data, mutate, isLoading } = useSWR<{ ipos: IpoRow[] }>("/api/ipos", fetcher);
  const ipos = data?.ipos ?? [];

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<IpoStatus | "All">("All");
  const [typeFilter, setTypeFilter] = useState<IpoType | "All">("All");

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<IpoRow | null>(null);
  const [form, setForm] = useState<Partial<IpoRow>>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return ipos.filter((ipo) => {
      if (statusFilter !== "All" && ipo.status !== statusFilter) return false;
      if (typeFilter !== "All" && ipo.type !== typeFilter) return false;
      if (search && !ipo.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [ipos, statusFilter, typeFilter, search]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setError(null);
    setFormOpen(true);
  }

  function openEdit(ipo: IpoRow) {
    setEditing(ipo);
    setForm(ipo);
    setError(null);
    setFormOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (editing) {
        await apiRequest(`/api/ipos/${editing.id}`, "PUT", form);
      } else {
        await apiRequest("/api/ipos", "POST", form);
      }
      await mutate();
      setFormOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(ipo: IpoRow) {
    if (!confirm(`Delete "${ipo.name}"? This cannot be undone.`)) return;
    await apiRequest(`/api/ipos/${ipo.id}`, "DELETE");
    await mutate();
  }

  async function handleSyncNow() {
    setSyncing(true);
    setSyncMessage(null);
    try {
      const result = await apiRequest<{ created: number; updated: number; errors: { url: string; message: string }[] }>(
        "/api/ipos/sync",
        "POST",
        {}
      );
      const gotAnything = result.created > 0 || result.updated > 0;
      if (gotAnything) {
        setSyncMessage(`Synced: ${result.created} added, ${result.updated} updated just now.`);
      } else if (result.errors?.length) {
        setSyncMessage(
          "Automatic fetch isn't available from that source right now (the site may be blocking automated visits). " +
            "No problem — just use \"Add IPO\" or \"Bulk Import\" below to enter it yourself, it only takes a moment."
        );
      } else {
        setSyncMessage("No new IPOs found. Everything here is already up to date.");
      }
      await mutate();
    } catch (err) {
      setSyncMessage(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  async function handleImport() {
    setSyncing(true);
    setSyncMessage(null);
    try {
      const result = await apiRequest<{ created: number; updated: number }>("/api/ipos/sync", "POST", {
        jsonImport: importText,
      });
      setSyncMessage(`Imported: ${result.created} created, ${result.updated} updated.`);
      setImportOpen(false);
      setImportText("");
      await mutate();
    } catch (err) {
      setSyncMessage(err instanceof Error ? err.message : "Import failed");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="IPO Market Watch"
        subtitle="Mainboard & SME IPOs — dates, price band, lot size, status and GMP."
        action={
          canEdit ? (
            <div className="flex gap-2">
              <button className="btn-secondary" onClick={() => setImportOpen(true)}>
                <Upload size={15} /> Bulk Import
              </button>
              <button className="btn-secondary" onClick={handleSyncNow} disabled={syncing}>
                <RefreshCw size={15} className={syncing ? "animate-spin" : ""} /> Sync Now
              </button>
              <button className="btn-primary" onClick={openCreate}>
                <Plus size={15} /> Add IPO
              </button>
            </div>
          ) : undefined
        }
      />

      {syncMessage && (
        <div className="card mb-4 text-sm text-slate-600 dark:text-slate-300">{syncMessage}</div>
      )}

      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative">
          <Search size={15} className="absolute left-2.5 top-2.5 text-slate-400" />
          <input
            className="input w-56 pl-8"
            placeholder="Search IPO name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select className="input w-40" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as IpoStatus | "All")}>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s === "All" ? "All statuses" : s}
            </option>
          ))}
        </select>
        <select className="input w-40" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as IpoType | "All")}>
          <option value="All">All types</option>
          <option value="Mainboard">Mainboard</option>
          <option value="SME">SME</option>
        </select>
      </div>

      <div className="card overflow-x-auto p-0">
        <table className="w-full">
          <thead className="border-b border-slate-100 dark:border-slate-800">
            <tr>
              <th className="th">IPO Name</th>
              <th className="th">Type</th>
              <th className="th">Open</th>
              <th className="th">Close</th>
              <th className="th">Allotment</th>
              <th className="th">Listing</th>
              <th className="th">Price Band</th>
              <th className="th">Lot Size</th>
              <th className="th">Status</th>
              <th className="th">GMP</th>
              {(canEdit || canDelete) && <th className="th">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={11} className="td py-8 text-center text-slate-400">
                  Loading…
                </td>
              </tr>
            )}
            {!isLoading && filtered.length === 0 && (
              <tr>
                <td colSpan={11} className="td py-8 text-center text-slate-400">
                  No IPOs match your filters.
                </td>
              </tr>
            )}
            {filtered.map((ipo) => (
              <tr key={ipo.id} className="border-t border-slate-100 dark:border-slate-800">
                <td className="td font-medium">{ipo.name}</td>
                <td className="td">{ipo.type}</td>
                <td className="td">{formatDate(ipo.openDate)}</td>
                <td className="td">{formatDate(ipo.closeDate)}</td>
                <td className="td">{formatDate(ipo.allotmentDate)}</td>
                <td className="td">{formatDate(ipo.listingDate)}</td>
                <td className="td">
                  ₹{ipo.priceBandMin}–{ipo.priceBandMax}
                </td>
                <td className="td">{ipo.lotSize}</td>
                <td className="td">
                  <StatusBadge status={ipo.status} colorMap={IPO_STATUS_COLORS} />
                </td>
                <td className="td">₹{ipo.gmp}</td>
                {(canEdit || canDelete) && (
                  <td className="td">
                    <div className="flex gap-2">
                      {canEdit && (
                        <button onClick={() => openEdit(ipo)} className="text-slate-400 hover:text-brand-600">
                          <Pencil size={15} />
                        </button>
                      )}
                      {canDelete && (
                        <button onClick={() => handleDelete(ipo)} className="text-slate-400 hover:text-red-600">
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

      <Modal open={formOpen} onClose={() => setFormOpen(false)} title={editing ? "Edit IPO" : "Add IPO"} wide>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label">IPO Name</label>
            <input
              className="input"
              required
              value={form.name ?? ""}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Type</label>
            <select
              className="input"
              value={form.type ?? "Mainboard"}
              onChange={(e) => setForm({ ...form, type: e.target.value as IpoType })}
            >
              <option value="Mainboard">Mainboard</option>
              <option value="SME">SME</option>
            </select>
          </div>
          <div>
            <label className="label">Status</label>
            <select
              className="input"
              value={form.status ?? "Upcoming"}
              onChange={(e) => setForm({ ...form, status: e.target.value as IpoStatus })}
            >
              {STATUS_OPTIONS.filter((s) => s !== "All").map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Open Date</label>
            <input type="date" className="input" value={form.openDate ?? ""} onChange={(e) => setForm({ ...form, openDate: e.target.value })} />
          </div>
          <div>
            <label className="label">Close Date</label>
            <input type="date" className="input" value={form.closeDate ?? ""} onChange={(e) => setForm({ ...form, closeDate: e.target.value })} />
          </div>
          <div>
            <label className="label">Allotment Date</label>
            <input type="date" className="input" value={form.allotmentDate ?? ""} onChange={(e) => setForm({ ...form, allotmentDate: e.target.value })} />
          </div>
          <div>
            <label className="label">Refund Date</label>
            <input type="date" className="input" value={form.refundDate ?? ""} onChange={(e) => setForm({ ...form, refundDate: e.target.value })} />
          </div>
          <div>
            <label className="label">Listing Date</label>
            <input type="date" className="input" value={form.listingDate ?? ""} onChange={(e) => setForm({ ...form, listingDate: e.target.value })} />
          </div>
          <div>
            <label className="label">Exchange</label>
            <input className="input" value={form.exchange ?? ""} onChange={(e) => setForm({ ...form, exchange: e.target.value })} placeholder="NSE / BSE" />
          </div>
          <div>
            <label className="label">Price Band Min (₹)</label>
            <input type="number" className="input" value={form.priceBandMin ?? 0} onChange={(e) => setForm({ ...form, priceBandMin: Number(e.target.value) })} />
          </div>
          <div>
            <label className="label">Price Band Max (₹)</label>
            <input type="number" className="input" value={form.priceBandMax ?? 0} onChange={(e) => setForm({ ...form, priceBandMax: Number(e.target.value) })} />
          </div>
          <div>
            <label className="label">Lot Size</label>
            <input type="number" className="input" value={form.lotSize ?? 0} onChange={(e) => setForm({ ...form, lotSize: Number(e.target.value) })} />
          </div>
          <div>
            <label className="label">Issue Size</label>
            <input className="input" value={form.issueSize ?? ""} onChange={(e) => setForm({ ...form, issueSize: e.target.value })} placeholder="e.g. ₹450 Cr" />
          </div>
          <div>
            <label className="label">GMP (₹ per share)</label>
            <input type="number" className="input" value={form.gmp ?? 0} onChange={(e) => setForm({ ...form, gmp: Number(e.target.value) })} />
          </div>
          <div>
            <label className="label">Listing Price (₹, once listed)</label>
            <input
              type="number"
              className="input"
              value={form.listingPrice ?? ""}
              onChange={(e) => setForm({ ...form, listingPrice: e.target.value ? Number(e.target.value) : null })}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Source URL</label>
            <input className="input" value={form.sourceUrl ?? ""} onChange={(e) => setForm({ ...form, sourceUrl: e.target.value })} />
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

      <Modal open={importOpen} onClose={() => setImportOpen(false)} title="Bulk Import IPOs (JSON)" wide>
        <p className="mb-2 text-sm text-slate-500 dark:text-slate-400">
          Paste a JSON array of IPO objects, e.g.{" "}
          <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">
            {`[{"name":"Example Ltd","type":"Mainboard","openDate":"2026-09-01","closeDate":"2026-09-03","priceBandMin":100,"priceBandMax":110,"lotSize":130,"gmp":15}]`}
          </code>
        </p>
        <textarea
          className="input font-mono text-xs"
          rows={10}
          value={importText}
          onChange={(e) => setImportText(e.target.value)}
          placeholder="[ ... ]"
        />
        <div className="mt-3 flex justify-end gap-2">
          <button className="btn-secondary" onClick={() => setImportOpen(false)}>
            Cancel
          </button>
          <button className="btn-primary" onClick={handleImport} disabled={syncing || !importText.trim()}>
            {syncing ? "Importing…" : "Import"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
