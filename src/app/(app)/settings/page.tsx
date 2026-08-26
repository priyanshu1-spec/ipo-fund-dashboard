"use client";

import useSWR from "swr";
import { useSession } from "next-auth/react";
import { Database, KeyRound, ShieldAlert, ShieldCheck, ShieldOff } from "lucide-react";
import { fetcher } from "@/lib/fetcher";
import { PageHeader } from "@/components/PageHeader";
import type { FetchLogEntry, SourceHealth } from "@/types";

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
    <div className="space-y-8">
      <section>
        <PageHeader title="Settings" subtitle="How this dashboard stores data and controls access." />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="card flex items-start gap-3">
            <Database className="mt-0.5 shrink-0 text-brand-600" size={18} />
            <div className="text-sm text-slate-600 dark:text-slate-300">
              <p className="font-semibold text-slate-800 dark:text-slate-100">Server-side database</p>
              <p>
                All IPO data, applications, funds, and investors are stored in a Postgres database on
                the server. Data survives browser refresh, PC restart, and redeployments.
              </p>
            </div>
          </div>
          <div className="card flex items-start gap-3">
            <KeyRound className="mt-0.5 shrink-0 text-fuchsia-600" size={18} />
            <div className="text-sm text-slate-600 dark:text-slate-300">
              <p className="font-semibold text-slate-800 dark:text-slate-100">Access</p>
              <p>
                Full-access and (optional) read-only passwords are set as environment variables. To
                revoke access for everyone at once, change them and redeploy.
              </p>
            </div>
          </div>
        </div>
      </section>

      <ProviderHealthSection />
      <FetchLogSection />
    </div>
  );
}

function ProviderHealthSection() {
  const { data, isLoading } = useSWR<{ sources: SourceHealth[] }>("/api/admin/ipo/fetch-status", fetcher);
  const sources = data?.sources ?? [];

  return (
    <section>
      <PageHeader
        title="IPO Data Source Health"
        subtitle="Status of each automated data provider. If one fails, the rest of the dashboard keeps working on existing data."
      />
      <div className="card overflow-x-auto p-0">
        <table className="w-full">
          <thead className="border-b border-slate-100 dark:border-slate-800">
            <tr>
              <th className="th">Provider</th>
              <th className="th">Status</th>
              <th className="th">Last Successful Fetch</th>
              <th className="th">Last Run</th>
              <th className="th">Error</th>
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
            {!isLoading && sources.length === 0 && (
              <tr>
                <td colSpan={5} className="td py-6 text-center text-slate-400">
                  No sync has run yet — click &quot;Refresh IPO Data&quot; on the IPO Market Watch page.
                </td>
              </tr>
            )}
            {sources.map((s) => (
              <tr key={s.provider} className="border-t border-slate-100 dark:border-slate-800">
                <td className="td font-medium capitalize">{s.provider}</td>
                <td className="td">
                  <span
                    className={`badge flex w-fit items-center gap-1 ${
                      s.status === "healthy"
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                        : s.status === "failing"
                        ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
                        : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {s.status === "healthy" ? <ShieldCheck size={12} /> : <ShieldAlert size={12} />}
                    {s.status}
                  </span>
                </td>
                <td className="td">{s.lastSuccessAt ? new Date(s.lastSuccessAt).toLocaleString("en-IN") : "—"}</td>
                <td className="td">{s.lastRunAt ? new Date(s.lastRunAt).toLocaleString("en-IN") : "—"}</td>
                <td className="td max-w-xs truncate text-xs text-red-600" title={s.lastError}>
                  {s.lastError || "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function FetchLogSection() {
  const { data, isLoading } = useSWR<{ logs: FetchLogEntry[] }>("/api/admin/ipo/fetch-logs", fetcher);
  const logs = data?.logs ?? [];

  return (
    <section>
      <PageHeader title="Fetch Logs" subtitle="Every automated or manual sync attempt, most recent first." />
      <div className="card max-h-96 overflow-y-auto p-0">
        <table className="w-full">
          <thead className="sticky top-0 border-b border-slate-100 bg-white dark:border-slate-800 dark:bg-slate-900">
            <tr>
              <th className="th">Started</th>
              <th className="th">Provider</th>
              <th className="th">Result</th>
              <th className="th">Found / Added / Updated</th>
              <th className="th">Error</th>
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
            {!isLoading && logs.length === 0 && (
              <tr>
                <td colSpan={5} className="td py-6 text-center text-slate-400">
                  No fetch attempts logged yet.
                </td>
              </tr>
            )}
            {logs.map((l) => (
              <tr key={l.id} className="border-t border-slate-100 dark:border-slate-800">
                <td className="td whitespace-nowrap">{new Date(l.startedAt).toLocaleString("en-IN")}</td>
                <td className="td">{l.provider}</td>
                <td className="td">
                  <span className={`badge ${l.success ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"}`}>
                    {l.success ? "success" : "failed"}
                  </span>
                </td>
                <td className="td">
                  {l.recordsFound} / {l.recordsInserted} / {l.recordsUpdated}
                </td>
                <td className="td max-w-xs truncate text-xs text-red-600" title={l.errorMessage}>
                  {l.errorMessage || "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
