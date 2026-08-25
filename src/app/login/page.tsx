"use client";

import { signIn, useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";
import { TrendingUp } from "lucide-react";

function LoginCard() {
  const { status } = useSession();
  const router = useRouter();
  const params = useSearchParams();
  const error = params.get("error");

  useEffect(() => {
    if (status === "authenticated") router.replace("/");
  }, [status, router]);

  return (
    <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-card dark:border-slate-800 dark:bg-slate-900">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600 text-white">
        <TrendingUp size={24} />
      </div>
      <h1 className="text-lg font-bold text-slate-900 dark:text-white">IPO Fund Dashboard</h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Private access only. Sign in with the Google account that has been granted access.
      </p>

      {error && (
        <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">
          Sign-in failed or your account does not have access yet. Ask the dashboard owner to add
          your email in Settings → Access.
        </p>
      )}

      <button onClick={() => signIn("google", { callbackUrl: "/" })} className="btn-primary mt-6 w-full">
        Sign in with Google
      </button>
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
