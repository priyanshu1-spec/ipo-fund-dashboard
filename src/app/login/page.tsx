"use client";

import Link from "next/link";
import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { TrendingUp } from "lucide-react";

function LoginCard() {
  const { status } = useSession();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (status === "authenticated") router.replace("/");
  }, [status, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const result = await signIn("credentials", { email, password, redirect: false });
    setSubmitting(false);
    if (result?.error) {
      setError(
        email
          ? "Wrong email/username or password, or your account hasn't been approved by an admin yet."
          : "Wrong password. Ask whoever gave you access to double-check it."
      );
      return;
    }
    router.replace("/");
    router.refresh();
  }

  return (
    <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-card dark:border-slate-800 dark:bg-slate-900">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-fuchsia-600 text-white">
        <TrendingUp size={24} />
      </div>
      <h1 className="text-lg font-bold text-slate-900 dark:text-white">IPO Fund Dashboard</h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Private access only. Sign in with your account, or the shared access password if that&apos;s
        what you were given.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-3 text-left">
        <div>
          <label className="label">Email or Username (leave blank if you were given a shared password)</label>
          <input
            type="text"
            className="input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com or your username"
            autoComplete="username"
          />
        </div>
        <div>
          <label className="label">Password</label>
          <input
            type="password"
            required
            className="input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
          />
        </div>
        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">
            {error}
          </p>
        )}
        <button type="submit" className="btn-primary w-full" disabled={submitting || !password}>
          {submitting ? "Checking…" : "Enter"}
        </button>
      </form>

      <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
        No account yet?{" "}
        <Link href="/register" className="font-medium text-brand-600 hover:underline">
          Request access
        </Link>
        {" "}— an admin will need to approve it.
      </p>
      <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
        Forgot your password?{" "}
        <Link href="/forgot-password" className="font-medium text-brand-600 hover:underline">
          Reset it by email
        </Link>
        , or ask your admin to reset it for you from the Admin panel.
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 dark:bg-slate-950">
      <Suspense fallback={null}>
        <LoginCard />
      </Suspense>
    </div>
  );
}
