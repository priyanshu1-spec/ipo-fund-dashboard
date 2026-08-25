import { clsx, type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount || 0);
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat("en-IN").format(n || 0);
}

export function formatDate(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(d);
}

export function daysUntil(iso: string): number | null {
  if (!iso) return null;
  const target = new Date(iso);
  if (isNaN(target.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

/** Masks a PAN for display, e.g. ABCDE1234F -> ABCXX1234F is NOT how PAN masking works legally;
 * we simply show first 3 and last 1 char: ABC******F */
export function maskPan(pan: string): string {
  if (!pan || pan.length < 6) return pan;
  return `${pan.slice(0, 3)}${"*".repeat(pan.length - 4)}${pan.slice(-1)}`;
}

export const IPO_STATUS_COLORS: Record<string, string> = {
  Upcoming: "bg-slate-100 text-slate-700 dark:bg-slate-700/50 dark:text-slate-200",
  Open: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300",
  Closed: "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300",
  "Allotment Awaited": "bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300",
  Allotted: "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300",
  Listed: "bg-teal-100 text-teal-700 dark:bg-teal-900/50 dark:text-teal-300",
};

export const ALLOTMENT_STATUS_COLORS: Record<string, string> = {
  Pending: "bg-slate-100 text-slate-700 dark:bg-slate-700/50 dark:text-slate-200",
  Allotted: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300",
  "Not Allotted": "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300",
  Partial: "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300",
};
