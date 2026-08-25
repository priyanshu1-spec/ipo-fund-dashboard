import { cn } from "@/lib/utils";

export function StatusBadge({ status, colorMap }: { status: string; colorMap: Record<string, string> }) {
  return (
    <span className={cn("badge", colorMap[status] ?? "bg-slate-100 text-slate-700")}>{status}</span>
  );
}
