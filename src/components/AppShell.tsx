"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
  LayoutDashboard,
  ListChecks,
  TrendingUp,
  Users,
  Wallet,
  Settings,
  LogOut,
  Download,
  Menu,
  X,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/ThemeToggle";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/ipos", label: "IPO Market Watch", icon: TrendingUp },
  { href: "/applications", label: "Applications", icon: ListChecks },
  { href: "/funds", label: "Fund Ledger", icon: Wallet },
  { href: "/investors", label: "Investors", icon: Users },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [mobileOpen, setMobileOpen] = useState(false);
  const role = session?.user?.role ?? "viewer";
  const canEdit = role === "editor";

  const navLinks = (
    <nav className="flex flex-1 flex-col gap-1 px-2">
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setMobileOpen(false)}
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-brand-600 text-white"
                : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            )}
          >
            <Icon size={17} />
            {item.label}
          </Link>
        );
      })}
      {canEdit && (
        <Link
          href="/settings"
          onClick={() => setMobileOpen(false)}
          className={cn(
            "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
            pathname === "/settings"
              ? "bg-brand-600 text-white"
              : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          )}
        >
          <Settings size={17} />
          Settings & Audit Log
        </Link>
      )}
      <a
        href="/api/export"
        className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
      >
        <Download size={17} />
        Export to Excel
      </a>
    </nav>
  );

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 flex-col border-r border-slate-200 bg-white py-4 dark:border-slate-800 dark:bg-slate-900 md:flex">
        <div className="mb-4 px-4">
          <h1 className="text-base font-bold text-slate-900 dark:text-white">IPO Fund Dashboard</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">Personal Portfolio Tracker</p>
        </div>
        {navLinks}
        <UserFooter />
      </aside>

      {/* Mobile top bar + drawer */}
      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900 md:hidden">
          <button onClick={() => setMobileOpen(true)} aria-label="Open menu">
            <Menu size={22} />
          </button>
          <span className="text-sm font-bold">IPO Fund Dashboard</span>
          <ThemeToggle />
        </header>
        {mobileOpen && (
          <div className="fixed inset-0 z-50 flex md:hidden">
            <div className="w-72 flex-col bg-white py-4 dark:bg-slate-900 flex">
              <div className="mb-4 flex items-center justify-between px-4">
                <h1 className="text-base font-bold">Menu</h1>
                <button onClick={() => setMobileOpen(false)} aria-label="Close menu">
                  <X size={20} />
                </button>
              </div>
              {navLinks}
              <UserFooter />
            </div>
            <div className="flex-1 bg-black/40" onClick={() => setMobileOpen(false)} />
          </div>
        )}

        <div className="hidden items-center justify-end gap-2 border-b border-slate-200 bg-white px-6 py-2.5 dark:border-slate-800 dark:bg-slate-900 md:flex">
          <ThemeToggle />
        </div>

        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}

function UserFooter() {
  const { data: session } = useSession();
  const role = session?.user?.role ?? "viewer";
  return (
    <div className="mt-auto border-t border-slate-200 px-4 pt-3 dark:border-slate-800">
      <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">
        {role === "editor" ? "Full access" : "View only"}
      </p>
      <p className="mb-2 text-xs capitalize text-slate-500 dark:text-slate-400">Signed in via shared password</p>
      <button
        onClick={() => signOut({ callbackUrl: "/login" })}
        className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400"
      >
        <LogOut size={14} /> Sign out
      </button>
    </div>
  );
}
