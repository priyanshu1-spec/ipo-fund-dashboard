import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const ACCENTS = {
  brand: {
    chip: "bg-gradient-to-br from-indigo-500 to-blue-600",
    ring: "ring-indigo-100 dark:ring-indigo-900/40",
    bar: "from-indigo-500 to-blue-600",
  },
  emerald: {
    chip: "bg-gradient-to-br from-emerald-400 to-teal-600",
    ring: "ring-emerald-100 dark:ring-emerald-900/40",
    bar: "from-emerald-400 to-teal-600",
  },
  amber: {
    chip: "bg-gradient-to-br from-amber-400 to-orange-600",
    ring: "ring-amber-100 dark:ring-amber-900/40",
    bar: "from-amber-400 to-orange-600",
  },
  purple: {
    chip: "bg-gradient-to-br from-fuchsia-500 to-purple-600",
    ring: "ring-fuchsia-100 dark:ring-fuchsia-900/40",
    bar: "from-fuchsia-500 to-purple-600",
  },
  rose: {
    chip: "bg-gradient-to-br from-rose-400 to-pink-600",
    ring: "ring-rose-100 dark:ring-rose-900/40",
    bar: "from-rose-400 to-pink-600",
  },
  sky: {
    chip: "bg-gradient-to-br from-sky-400 to-cyan-600",
    ring: "ring-sky-100 dark:ring-sky-900/40",
    bar: "from-sky-400 to-cyan-600",
  },
} as const;

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
  accent?: keyof typeof ACCENTS;
  sub?: string;
}) {
  const a = ACCENTS[accent];
  return (
    <div className="card relative overflow-hidden">
      <div className={cn("absolute inset-x-0 top-0 h-1 bg-gradient-to-r", a.bar)} />
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
          <p className="mt-1 text-xl font-bold text-slate-900 dark:text-white">{value}</p>
          {sub && <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">{sub}</p>}
        </div>
        <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl text-white shadow-sm ring-4", a.chip, a.ring)}>
          <Icon size={18} />
        </div>
      </div>
    </div>
  );
}
