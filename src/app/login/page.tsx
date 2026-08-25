"use client";

import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { TrendingUp } from "lucide-react";

function LoginCard() {
  const { status } = useSession();
  const router = useRouter();
  const [username, setUsername] = useState("");
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
    const result = await signIn("credentials", { username, password, redirect: false });
    setSubmitting(false);
    if (result?.error) {
      setError("Wrong username or password.");
      return;
    }
    router.replace("/");
    router.refresh();
  }

  return (
    <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-card dark:border-slate-800 dark:bg-slate-900">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600 text-white">
        <TrendingUp size={24} />
      </div>
      <h1 className="text-lg font-bold text-slate-900 dark:text-white">IPO Fund Dashboard</h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Private access only. Sign in with the account you were given.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-3 text-left">
        <div>
          <label className="label">Username</label>
          <input
            required
            autoFocus
            className="input"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="e.g. priya"
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
          />
        </div>
        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">
            {error}
          </p>
        )}
        <button type="submit" className="btn-primary w-full" disabled={submitting || !username || !password}>
          {submitting ? "Checking…" : "Sign in"}
        </button>
      </form>
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
