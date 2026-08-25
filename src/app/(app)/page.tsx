"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  ListChecks,
  Wallet,
  Clock,
  TrendingUp,
  AlertTriangle,
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from "recharts";
import { useLocalEntities, STORAGE_KEYS } from "@/lib/localStorage";
import { buildFallbackIpos } from "@/lib/fallbackIpos";
import { buildDashboardSummary } from "@/lib/calculations";
import { findDuplicatePanWarnings } from "@/lib/duplicatePan";
import { MetricCard } from "@/components/MetricCard";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { formatCurrency, formatDate, daysUntil, IPO_STATUS_COLORS } from "@/lib/utils";
import type { ApplicationRow, FundAllocationRow, InvestorRow, IpoRow } from "@/types";

const PIE_COLORS = ["#6366f1", "#f43f5e"];

export default function DashboardPage() {
  const { items: ipos, isLoading } = useLocalEntities<IpoRow>(STORAGE_KEYS.ipos, "ipo", buildFallbackIpos());
  const { items: applications } = useLocalEntities<ApplicationRow>(STORAGE_KEYS.applications, "app");
  const { items: funds } = useLocalEntities<FundAllocationRow>(STORAGE_KEYS.funds, "fund");
  const { items: investors } = useLocalEntities<InvestorRow>(STORAGE_KEYS.investors, "inv");

  const summary = useMemo(
    () => buildDashboardSummary(ipos, applications, funds, investors),
    [ipos, applications, funds, investors]
  );
  const warnings = useMemo(() => findDuplicatePanWarnings(applications), [applications]);

  const upcomingOrOpen = ipos
    .filter((i) => i.status === "Upcoming" || i.status === "Open")
    .sort((a, b) => (a.closeDate < b.closeDate ? -1 : 1))
    .slice(0, 6);

  const pieData = [
    { name: "Self Capital", value: summary.totalSelfCapital },
    { name: "Third-Party Capital", value: summary.totalThirdPartyCapital },
  ];

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle="Live overview of active bids, blocked capital, and estimated returns. Stored in this browser only."
      />

      {warnings.length > 0 && (
        <div className="card mb-5 flex items-start gap-3 border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20">
          <AlertTriangle className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" size={18} />
          <div className="text-sm text-amber-800 dark:text-amber-200">
            <p className="font-semibold">Duplicate PAN detected</p>
            <p>
              The same PAN was used on more than one application for the same IPO — SEBI rejects
              duplicate retail applications. Review:{" "}
              {warnings.map((w) => `${w.ipoName} (${w.pan})`).join(", ")}
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Total Active Bids"
          value={isLoading ? "—" : String(summary.totalActiveBids)}
          icon={ListChecks}
          accent="sky"
        />
        <MetricCard
          label="Total Blocked Capital"
          value={isLoading ? "—" : formatCurrency(summary.totalBlockedCapital)}
          icon={Wallet}
          accent="purple"
          sub={`Self ${formatCurrency(summary.totalSelfCapital)} · Others ${formatCurrency(summary.totalThirdPartyCapital)}`}
        />
        <MetricCard
          label="Pending Allotments"
          value={isLoading ? "—" : String(summary.pendingAllotments)}
          icon={Clock}
          accent="amber"
        />
        <MetricCard
          label="Estimated Profit (GMP-based)"
          value={isLoading ? "—" : formatCurrency(summary.estimatedProfitFromGmp)}
          icon={TrendingUp}
          accent="emerald"
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-5">
        <div className="card lg:col-span-2">
          <h3 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">
            Capital Split: Self vs Third-Party
          </h3>
          {pieData.some((d) => d.value > 0) ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80}>
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="py-10 text-center text-sm text-slate-400">No fund allocation data yet.</p>
          )}
        </div>

        <div className="card lg:col-span-3">
          <h3 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">
            Monthly Realised P&amp;L
          </h3>
          {summary.monthlyPnl.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={summary.monthlyPnl}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-800" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
                <Bar dataKey="profit" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="py-10 text-center text-sm text-slate-400">
              No sold applications yet — realised P&amp;L will appear here.
            </p>
          )}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="card">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              Open / Upcoming IPOs
            </h3>
            <Link href="/ipos" className="text-xs font-medium text-brand-600 hover:underline">
              View all →
            </Link>
          </div>
          <div className="space-y-2">
            {upcomingOrOpen.length === 0 && (
              <p className="py-6 text-center text-sm text-slate-400">No upcoming or open IPOs.</p>
            )}
            {upcomingOrOpen.map((ipo) => {
              const days = daysUntil(ipo.closeDate);
              return (
                <div
                  key={ipo.id}
                  className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 dark:border-slate-800"
                >
                  <div>
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{ipo.name}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {formatDate(ipo.openDate)} – {formatDate(ipo.closeDate)} · GMP ₹{ipo.gmp}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {days != null && days >= 0 && ipo.status === "Open" && (
                      <span className="badge bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">
                        closes in {days}d
                      </span>
                    )}
                    <StatusBadge status={ipo.status} colorMap={IPO_STATUS_COLORS} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="card">
          <h3 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">
            Investor Ledger Snapshot
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="th">Investor</th>
                  <th className="th">Provided</th>
                  <th className="th">Outstanding</th>
                  <th className="th">Profit Share</th>
                </tr>
              </thead>
              <tbody>
                {summary.investorLedgers.length === 0 && (
                  <tr>
                    <td colSpan={4} className="td py-6 text-center text-slate-400">
                      No investors yet.
                    </td>
                  </tr>
                )}
                {summary.investorLedgers.map((l) => (
                  <tr key={l.investorId} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="td font-medium">{l.investorName}</td>
                    <td className="td">{formatCurrency(l.totalProvided)}</td>
                    <td className="td">{formatCurrency(l.outstandingToRepay)}</td>
                    <td className="td">{formatCurrency(l.netProfitShare)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
