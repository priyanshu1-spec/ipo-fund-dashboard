"use client";

import Link from "next/link";
import { useState } from "react";
import { TrendingUp } from "lucide-react";
import { apiRequest } from "@/lib/fetcher";
import { SECURITY_QUESTION_CUSTOM, SECURITY_QUESTION_PRESETS } from "@/lib/securityQuestions";

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [securityQuestionChoice, setSecurityQuestionChoice] = useState("");
  const [customSecurityQuestion, setCustomSecurityQuestion] = useState("");
  const [securityAnswer, setSecurityAnswer] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const securityQuestion =
    securityQuestionChoice === SECURITY_QUESTION_CUSTOM ? customSecurityQuestion : securityQuestionChoice;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await apiRequest("/api/auth/register", "POST", {
        name,
        email,
        username,
        password,
        securityQuestion,
        securityAnswer,
      });
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
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
        <h1 className="text-lg font-bold text-slate-900 dark:text-white">Request access</h1>

        {done ? (
          <div className="mt-6 space-y-3 text-left">
            <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
              Account created. An admin needs to approve it before you can sign in — check back once
              you&apos;ve heard from them.
            </p>
            <Link href="/login" className="btn-primary block w-full text-center">
              Back to sign in
            </Link>
          </div>
        ) : (
          <>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Your account will need an admin&apos;s approval before you can sign in.
            </p>
            <form onSubmit={handleSubmit} className="mt-6 space-y-3 text-left">
              <div>
                <label className="label">Name</label>
                <input
                  type="text"
                  required
                  autoFocus
                  className="input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                />
              </div>
              <div>
                <label className="label">Email</label>
                <input
                  type="email"
                  required
                  className="input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                />
              </div>
              <div>
                <label className="label">Username (optional — lets you sign in without your email)</label>
                <input
                  type="text"
                  className="input"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="letters, numbers, underscore — 3-30 characters"
                  autoComplete="username"
                  pattern="[a-zA-Z0-9_]{3,30}"
                  title="3-30 letters, numbers, or underscores"
                />
              </div>
              <div>
                <label className="label">Password</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  className="input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  autoComplete="new-password"
                />
              </div>
              <div>
                <label className="label">
                  Security question (optional now — needed later to reset your password without an admin)
                </label>
                <select
                  className="input"
                  value={securityQuestionChoice}
                  onChange={(e) => setSecurityQuestionChoice(e.target.value)}
                >
                  <option value="">Skip for now</option>
                  {SECURITY_QUESTION_PRESETS.map((q) => (
                    <option key={q} value={q}>
                      {q}
                    </option>
                  ))}
                  <option value={SECURITY_QUESTION_CUSTOM}>Write my own question…</option>
                </select>
              </div>
              {securityQuestionChoice === SECURITY_QUESTION_CUSTOM && (
                <div>
                  <label className="label">Your question</label>
                  <input
                    type="text"
                    className="input"
                    value={customSecurityQuestion}
                    onChange={(e) => setCustomSecurityQuestion(e.target.value)}
                    placeholder="e.g. What street did you grow up on?"
                  />
                </div>
              )}
              {securityQuestionChoice && (
                <div>
                  <label className="label">Your answer</label>
                  <input
                    type="text"
                    className="input"
                    value={securityAnswer}
                    onChange={(e) => setSecurityAnswer(e.target.value)}
                    placeholder="Answer isn't case-sensitive"
                  />
                </div>
              )}
              {error && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">
                  {error}
                </p>
              )}
              <button type="submit" className="btn-primary w-full" disabled={submitting}>
                {submitting ? "Submitting…" : "Request access"}
              </button>
            </form>
            <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
              Already have access?{" "}
              <Link href="/login" className="font-medium text-brand-600 hover:underline">
                Sign in
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
