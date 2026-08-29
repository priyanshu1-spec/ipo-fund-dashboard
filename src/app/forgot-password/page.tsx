"use client";

import Link from "next/link";
import { useState } from "react";
import { TrendingUp, ShieldCheck } from "lucide-react";
import { apiRequest } from "@/lib/fetcher";

export default function ForgotPasswordPage() {
  const [step, setStep] = useState<"email" | "answer">("email");
  const [email, setEmail] = useState("");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function handleLookup(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const result = await apiRequest<{ question: string }>("/api/auth/forgot-password", "POST", { email });
      setQuestion(result.question);
      setStep("answer");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to look up account");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (newPassword !== confirmPassword) {
      setError("New password and confirmation don't match.");
      return;
    }
    setSubmitting(true);
    try {
      await apiRequest("/api/auth/reset-password", "POST", { email, answer, newPassword });
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reset password");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 dark:bg-slate-950">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-card dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-fuchsia-600 text-white">
          <TrendingUp size={24} />
        </div>
        <h1 className="text-lg font-bold text-slate-900 dark:text-white">Reset your password</h1>

        {done ? (
          <div className="mt-6 space-y-3 text-left">
            <p className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
              <ShieldCheck size={16} className="shrink-0" /> Password changed. You can sign in with it now.
            </p>
            <Link href="/login" className="btn-primary block w-full text-center">
              Back to sign in
            </Link>
          </div>
        ) : step === "email" ? (
          <>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Enter your account email. If you set up a security question, you&apos;ll be asked it next.
              This only works for a real registered account — not the shared access password.
            </p>
            <form onSubmit={handleLookup} className="mt-6 space-y-3 text-left">
              <div>
                <label className="label">Email</label>
                <input
                  type="email"
                  required
                  autoFocus
                  className="input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                />
              </div>
              {error && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">
                  {error} If you don&apos;t have a security question set up, ask your admin to reset your
                  password from the Admin panel instead.
                </p>
              )}
              <button type="submit" className="btn-primary w-full" disabled={submitting}>
                {submitting ? "Checking…" : "Continue"}
              </button>
            </form>
          </>
        ) : (
          <>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Answer your security question and set a new password.
            </p>
            <form onSubmit={handleResetPassword} className="mt-6 space-y-3 text-left">
              <div>
                <label className="label">{question}</label>
                <input
                  type="text"
                  required
                  autoFocus
                  className="input"
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  placeholder="Your answer"
                />
              </div>
              <div>
                <label className="label">New password</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  className="input"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  autoComplete="new-password"
                />
              </div>
              <div>
                <label className="label">Confirm new password</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  className="input"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                />
              </div>
              {error && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">
                  {error}
                </p>
              )}
              <button type="submit" className="btn-primary w-full" disabled={submitting}>
                {submitting ? "Resetting…" : "Reset password"}
              </button>
              <button
                type="button"
                className="w-full text-center text-xs font-medium text-slate-500 hover:underline dark:text-slate-400"
                onClick={() => {
                  setStep("email");
                  setAnswer("");
                  setError(null);
                }}
              >
                Use a different email
              </button>
            </form>
          </>
        )}

        <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
          Remembered it?{" "}
          <Link href="/login" className="font-medium text-brand-600 hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
