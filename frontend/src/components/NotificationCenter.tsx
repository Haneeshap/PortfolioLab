"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type Notice = {
  id: number;
  source: string;
  title: string;
  message: string;
  targetUrl?: string | null;
  createdAt: string;
  readAt?: string | null;
};
type Filter = "all" | "unread" | "trades" | "risk" | "dividends";

function normalize(data: unknown): Notice[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    if (Array.isArray(obj.value)) return obj.value;
    if (Array.isArray(obj.notifications)) return obj.notifications;
  }
  throw new Error("Unexpected notification response");
}

function category(n: Notice): "trades" | "risk" | "dividends" | "other" {
  const s = `${n.source} ${n.title}`.toLowerCase();
  if (s.includes("dividend")) return "dividends";
  if (s.includes("agent") || s.includes("risk") || s.includes("concentration") || s.includes("insight")) return "risk";
  if (s.includes("trade") || s.includes("order") || s.includes("buy") || s.includes("sell")) return "trades";
  return "other";
}
function age(value: string) {
  const diff = Date.now() - new Date(value).getTime();
  if (!Number.isFinite(diff)) return "";
  if (diff < 60000) return "Just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}
const metadata = {
  trades: { label: "Trade", symbol: "⇄", color: "text-sky-300 bg-sky-400/10" },
  risk: { label: "Risk insight", symbol: "!", color: "text-amber-300 bg-amber-400/10" },
  dividends: { label: "Dividend", symbol: "+", color: "text-emerald-300 bg-emerald-400/10" },
  other: { label: "Activity", symbol: "•", color: "text-slate-300 bg-slate-400/10" },
};

export default function NotificationCenter({ compact = false, onNavigate }: { compact?: boolean; onNavigate?: () => void }) {
  const [items, setItems] = useState<Notice[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/portfolio/notifications", { cache: "no-store" });
      if (!response.ok) throw new Error("Unable to load notifications");
      const data = normalize(await response.json());
      setItems(data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
      setError(null);
    } catch {
      setError("Notifications are temporarily unavailable.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const interval = window.setInterval(() => {
      if (!document.hidden) void load();
    }, 15000);
    return () => window.clearInterval(interval);
  }, [load]);

  async function markRead(id: number): Promise<boolean> {
    const response = await fetch(`/api/portfolio/notifications/${id}/read`, { method: "PATCH" });
    if (!response.ok) return false;
    setItems(current => current.map(n => n.id === id ? { ...n, readAt: new Date().toISOString() } : n));
    window.dispatchEvent(new Event("portfoliolab:notifications-updated"));
    return true;
  }
  async function markOne(id: number) {
    setBusyId(id);
    try {
      if (!await markRead(id)) throw new Error();
      setError(null);
    } catch { setError("Unable to mark notification as read."); }
    finally { setBusyId(null); }
  }
  async function markAll() {
    setBusy(true);
    setError(null);
    const unread = items.filter(n => !n.readAt);
    let failures = 0;
    for (const item of unread) {
      try { if (!await markRead(item.id)) failures++; }
      catch { failures++; }
    }
    if (failures) setError(`${failures} notification(s) could not be updated. Please retry.`);
    setBusy(false);
    void load();
  }

  const unread = items.filter(n => !n.readAt).length;
  const visible = items.filter(n => filter === "all" || (filter === "unread" ? !n.readAt : category(n) === filter));
  const displayed = compact ? visible.slice(0, 5) : visible;
  const filters: { key: Filter; label: string }[] = [
    { key: "all", label: "All" }, { key: "unread", label: "Unread" },
    { key: "trades", label: "Trades" }, { key: "risk", label: "Risk" },
    { key: "dividends", label: "Dividends" },
  ];

  return (
    <section aria-label="Notification center" className={compact ? "" : "mx-auto max-w-4xl"}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 p-4">
        <div>
          <h2 className="text-base font-semibold text-white">Notifications</h2>
          <p className="mt-1 text-xs text-slate-400">{unread} unread · Simulated portfolio activity</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => { setLoading(true); void load(); }} className="rounded-lg px-3 py-2 text-xs text-slate-300 hover:bg-slate-800">Refresh</button>
          <button type="button" disabled={busy || unread === 0} onClick={() => void markAll()} className="rounded-lg bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-300 hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-40">{busy ? "Updating…" : "Mark all as read"}</button>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 border-b border-slate-800 px-4 py-3" aria-label="Notification filters">
        {filters.map(f => <button key={f.key} type="button" onClick={() => setFilter(f.key)} aria-pressed={filter === f.key} className={`rounded-full px-3 py-1.5 text-xs transition ${filter === f.key ? "bg-emerald-500 text-slate-950 font-semibold" : "bg-slate-800 text-slate-300 hover:bg-slate-700"}`}>{f.label}</button>)}
      </div>
      {error && <p role="alert" className="px-4 py-3 text-sm text-rose-400">{error}</p>}
      {loading && items.length === 0 && <p className="px-4 py-12 text-center text-sm text-slate-400">Loading notifications…</p>}
      {!loading && displayed.length === 0 && <div className="px-6 py-16 text-center"><p className="font-medium text-slate-200">Nothing to show</p><p className="mt-2 text-sm text-slate-500">New simulated trades, dividends, and risk insights will appear here.</p></div>}
      <div className={compact ? "max-h-[26rem] overflow-y-auto" : ""}>
        {displayed.map(n => {
          const meta = metadata[category(n)];
          const target = n.targetUrl?.startsWith("/") && !n.targetUrl.startsWith("//") && !n.targetUrl.includes("\\") ? n.targetUrl : null;
          return <article key={n.id} className={`flex gap-3 border-b border-slate-800/80 p-4 last:border-0 ${!n.readAt ? "bg-emerald-500/[0.045]" : ""}`}>
            <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl font-bold ${meta.color}`} aria-hidden="true">{meta.symbol}</div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2"><span className="text-[11px] font-medium text-slate-400">{meta.label}</span>{!n.readAt && <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" aria-label="Unread"/>}<time className="ml-auto text-[11px] text-slate-500" dateTime={n.createdAt} title={new Date(n.createdAt).toLocaleString()}>{age(n.createdAt)}</time></div>
              <h3 className="mt-1 text-sm font-semibold text-slate-100">{n.title}</h3>
              <p className="mt-1 text-xs leading-relaxed text-slate-400">{n.message}</p>
              <div className="mt-3 flex flex-wrap gap-4">
                {target && <Link href={target} onClick={onNavigate} className="text-xs font-medium text-emerald-400 hover:text-emerald-300">View details →</Link>}
                {!n.readAt && <button type="button" disabled={busyId === n.id || busy} onClick={() => void markOne(n.id)} className="text-xs text-slate-300 hover:text-white disabled:opacity-40">{busyId === n.id ? "Updating…" : "Mark as read"}</button>}
              </div>
            </div>
          </article>;
        })}
      </div>
      {compact && <div className="border-t border-slate-800 p-3 text-center"><Link href="/notifications" onClick={onNavigate} className="text-sm font-medium text-emerald-400 hover:text-emerald-300">View all notifications →</Link></div>}
    </section>
  );
}
