"use client";

import useSWR from "swr";
import { useSession } from "next-auth/react";
import { KeyRound, ShieldOff } from "lucide-react";
import { fetcher } from "@/lib/fetcher";
import { PageHeader } from "@/components/PageHeader";
import type { AuditLogRow } from "@/types";

export default function SettingsPage() {
  const { data: session, status } = useSession();
  const role = session?.user?.role;

  if (status === "loading") return <p className="text-sm text-slate-400">Loading…</p>;
  if (role !== "editor") {
    return (
      <div className="card flex items-center gap-3">
        <ShieldOff className="text-red-500" size={20} />
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Only full-access users can view Settings and the audit log.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <AccessInfoSection />
      <AuditLogSection />
    </div>
  );
}

function AccessInfoSection() {
  return (
    <section>
      <PageHeader
        title="Access"
        subtitle="This dashboard uses a shared password instead of individual accounts — simplest to set up and share."
      />
      <div className="card space-y-3">
        <div className="flex items-start gap-3">
          <KeyRound className="mt-0.5 shrink-0 text-brand-600" size={18} />
          <div className="text-sm text-slate-600 dark:text-slate-300">
            <p className="font-semibold text-slate-800 dark:text-slate-100">
              To share this dashboard with someone
            </p>
            <p>Just send them the link and the password. That&apos;s the whole process — no invites, no sign-up.</p>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <KeyRound className="mt-0.5 shrink-0 text-amber-600" size={18} />
          <div className="text-sm text-slate-600 dark:text-slate-300">
            <p className="font-semibold text-slate-800 dark:text-slate-100">
              Two optional tiers
            </p>
            <p>
              <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">APP_ACCESS_PASSWORD</code> —
              full access (add/edit/delete). <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">APP_VIEWER_PASSWORD</code> —
              optional, read-only. Give the viewer password to someone you only want to see the numbers.
            </p>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <ShieldOff className="mt-0.5 shrink-0 text-red-600" size={18} />
          <div className="text-sm text-slate-600 dark:text-slate-300">
            <p className="font-semibold text-slate-800 dark:text-slate-100">To revoke access</p>
            <p>
              Change the password in your hosting provider&apos;s Environment Variables and redeploy —
              every existing session stops working immediately, for everyone. There&apos;s no per-person
              list to manage since no one has an individual account.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function AuditLogSection() {
  const { data, isLoading } = useSWR<{ entries: AuditLogRow[] }>("/api/audit", fetcher);
  const entries = data?.entries ?? [];

  return (
    <section>
      <PageHeader
        title="Audit Log"
        subtitle="Every create, update and delete, with when it happened. Since access is a shared password, entries are labeled by access tier, not by person."
      />
      <div className="card max-h-96 overflow-y-auto p-0">
        <table className="w-full">
          <thead className="sticky top-0 border-b border-slate-100 bg-white dark:border-slate-800 dark:bg-slate-900">
            <tr>
              <th className="th">Time</th>
              <th className="th">Access Tier</th>
              <th className="th">Action</th>
              <th className="th">Entity</th>
              <th className="th">Details</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={5} className="td py-8 text-center text-slate-400">
                  Loading…
                </td>
              </tr>
            )}
            {!isLoading && entries.length === 0 && (
              <tr>
                <td colSpan={5} className="td py-8 text-center text-slate-400">
                  No activity logged yet.
                </td>
              </tr>
            )}
            {entries.map((e) => (
              <tr key={e.id} className="border-t border-slate-100 dark:border-slate-800">
                <td className="td whitespace-nowrap">{new Date(e.timestamp).toLocaleString("en-IN")}</td>
                <td className="td capitalize">{e.actor}</td>
                <td className="td capitalize">{e.action}</td>
                <td className="td">{e.entityType}</td>
                <td className="td max-w-xs truncate" title={e.details}>
                  {e.details}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
