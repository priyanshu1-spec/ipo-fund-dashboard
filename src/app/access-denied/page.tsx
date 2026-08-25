import Link from "next/link";
import { ShieldOff } from "lucide-react";

export default function AccessDeniedPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 dark:bg-slate-950">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-card dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-red-600 text-white">
          <ShieldOff size={24} />
        </div>
        <h1 className="text-lg font-bold text-slate-900 dark:text-white">Access denied</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Your Google account does not have access to this dashboard. Ask the owner to add your
          email under Settings → Access.
        </p>
        <Link href="/login" className="btn-secondary mt-6 inline-flex">
          Back to sign in
        </Link>
      </div>
    </div>
  );
}
