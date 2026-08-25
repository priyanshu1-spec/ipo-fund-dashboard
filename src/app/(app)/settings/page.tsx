"use client";

import { useSession } from "next-auth/react";
import { Download, HardDrive, KeyRound, ShieldOff, TriangleAlert } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { exportAllToExcel } from "@/lib/xlsxExport";

export default function SettingsPage() {
  const { data: session, status } = useSession();
  const role = session?.user?.role;

  if (status === "loading") return <p className="text-sm text-slate-400">Loading…</p>;
  if (role !== "editor") {
    return (
      <div className="card flex items-center gap-3">
        <ShieldOff className="text-red-500" size={20} />
        <p className="text-sm text-slate-600 dark:text-slate-300">Only full-access users can view Settings.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" subtitle="How this dashboard stores data and controls access." />

      <div className="card flex items-start gap-3">
        <HardDrive className="mt-0.5 shrink-0 text-brand-600" size={18} />
        <div className="text-sm text-slate-600 dark:text-slate-300">
          <p className="font-semibold text-slate-800 dark:text-slate-100">
            This dashboard has no backend database
          </p>
          <p>
            Every IPO, application, fund entry, and investor you add is stored only in{" "}
            <strong>this browser</strong>, using its local storage. There is nothing to connect,
            no server to configure.
          </p>
        </div>
      </div>

      <div className="card flex items-start gap-3 border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20">
        <TriangleAlert className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" size={18} />
        <div className="text-sm text-amber-800 dark:text-amber-200">
          <p className="font-semibold">Important: data is not shared or synced</p>
          <p>
            If you (or anyone you give access to) opens this dashboard from a different browser or
            device, they will see an empty dashboard, not the same data — nothing is sent to a
            server. Clearing your browser&apos;s site data, using a private/incognito window, or
            switching browsers will also start you over.
          </p>
        </div>
      </div>

      <div className="card flex items-start gap-3">
        <Download className="mt-0.5 shrink-0 text-emerald-600" size={18} />
        <div className="flex-1 text-sm text-slate-600 dark:text-slate-300">
          <p className="font-semibold text-slate-800 dark:text-slate-100">Back up regularly</p>
          <p className="mb-2">
            Since your data only exists in this browser, export it often — this is your only
            backup and the only way to move data to another device.
          </p>
          <button className="btn-secondary" onClick={exportAllToExcel}>
            <Download size={15} /> Export to Excel now
          </button>
        </div>
      </div>

      <div className="card flex items-start gap-3">
        <KeyRound className="mt-0.5 shrink-0 text-fuchsia-600" size={18} />
        <div className="text-sm text-slate-600 dark:text-slate-300">
          <p className="font-semibold text-slate-800 dark:text-slate-100">Access</p>
          <p>
            Everyone you give the dashboard link and password to gets full access with that one
            shared password (or a separate read-only password, if you set
            <code className="mx-1 rounded bg-slate-100 px-1 dark:bg-slate-800">APP_VIEWER_PASSWORD</code>
            ). To cut off access for everyone at once, change the password(s) in your hosting
            provider&apos;s environment variables and redeploy.
          </p>
        </div>
      </div>
    </div>
  );
}
