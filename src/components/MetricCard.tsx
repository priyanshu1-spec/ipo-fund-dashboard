import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function MetricCard({
  label,
  value,
  icon: Icon,
  accent = "brand",
  sub,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  accent?: "brand" | "emerald" | "amber" | "purple";
  sub?: string;
}) {
  const accentClasses: Record<string, string> = {
    brand: "bg-brand-50 text-brand-600 dark:bg-brand-900/40 dark:text-brand-300",
    emerald: "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300",
    amber: "bg-amber-50 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300",
    purple: "bg-purple-50 text-purple-600 dark:bg-purple-900/40 dark:text-purple-300",
  };
  return (
    <div className="card flex items-start justify-between">
      <div>
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
        <p className="mt-1 text-xl font-bold text-slate-900 dark:text-white">{value}</p>
        {sub && <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">{sub}</p>}
      </div>
      <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg", accentClasses[accent])}>
        <Icon size={18} />
      </div>
    </div>
  );
}
