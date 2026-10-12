"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";

const navigation = [
  { label: "Overview", href: "/", icon: "▦" },
  { label: "Markets", href: "/markets", icon: "↗" },
  { label: "Portfolio", href: "/portfolio", icon: "◈" },
  { label: "Activity", href: "/activity", icon: "◷" },
];

export default function AppShell({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  const currentPage =
    navigation.find((item) => item.href === pathname)?.label ??
    "PortfolioLab";

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 border-r border-slate-800 bg-slate-900 transition-transform duration-200 lg:translate-x-0 ${
          menuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-20 items-center gap-3 border-b border-slate-800 px-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500 text-xl font-bold text-slate-950">
            P
          </div>

          <div>
            <p className="font-bold tracking-tight">PortfolioLab</p>
            <p className="text-xs text-slate-400">
              Investment Simulator
            </p>
          </div>
        </div>

        <nav aria-label="Main navigation" className="space-y-2 p-4">
          {navigation.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMenuOpen(false)}
              className={`flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition ${
                pathname === item.href
                  ? "bg-emerald-500/10 text-emerald-400"
                  : "text-slate-400 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <span aria-hidden="true" className="text-lg">
                {item.icon}
              </span>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="absolute bottom-0 w-full border-t border-slate-800 p-5">
          <p className="text-xs font-medium text-emerald-400">
            SIMULATION MODE
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Fictional assets. No real trading.
          </p>
        </div>
      </aside>

      {menuOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          className="fixed inset-0 z-30 bg-black/60 lg:hidden"
          onClick={() => setMenuOpen(false)}
        />
      )}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-20 items-center justify-between border-b border-slate-800 bg-slate-950/95 px-5 backdrop-blur sm:px-8">
          <div className="flex items-center gap-4">
            <button
              type="button"
              aria-label="Open navigation"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen(!menuOpen)}
              className="rounded-lg border border-slate-700 p-2 text-slate-200 lg:hidden"
            >
              ☰
            </button>

            <div>
              <p className="text-xs uppercase tracking-widest text-slate-500">
                Workspace
              </p>
              <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
                {currentPage}
              </h1>
            </div>
          </div>

          <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-400">
            Simulation
          </span>
        </header>

        <main className="mx-auto max-w-7xl space-y-8 px-5 py-8 sm:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
