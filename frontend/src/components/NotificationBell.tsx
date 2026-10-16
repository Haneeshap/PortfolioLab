"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import NotificationCenter from "./NotificationCenter";
import { startNotificationUpdates } from "@/lib/notification-updates";

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/portfolio/notifications/unread-count", { cache: "no-store" });
      if (!response.ok) return;
      const data = await response.json();
      const n = typeof data === "number" ? data : data.unreadCount ?? data.count ?? 0;
      setCount(Number(n) || 0);
    } catch { /* Bell should not break the rest of the app. */ }
  }, []);
  useEffect(() => {
    // Fetch persisted unread state on mount or when opening the menu.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
    const stop = startNotificationUpdates(() => window.dispatchEvent(new Event("portfoliolab:notifications-updated")));
    window.addEventListener("portfoliolab:notifications-updated", refresh);
    return () => { stop(); window.removeEventListener("portfoliolab:notifications-updated", refresh); };
  }, [refresh]);
  useEffect(() => {
    if (!open) return;
    // Fetch persisted unread state on mount or when opening the menu.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
    const pointer = (event: PointerEvent) => { if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false); };
    const key = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", pointer);
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("pointerdown", pointer); document.removeEventListener("keydown", key); };
  }, [open, refresh]);
  return <div className="relative" ref={ref}>
    <button type="button" aria-label={count ? `Notifications, ${count} unread` : "Notifications"} aria-expanded={open} aria-haspopup="dialog" onClick={() => setOpen(v => !v)} className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-slate-700 bg-slate-900 text-slate-300 transition hover:bg-slate-800 hover:text-white">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></svg>
      {count > 0 && <span className="absolute -right-1.5 -top-1.5 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-emerald-500 px-1 text-[10px] font-bold text-slate-950">{count > 99 ? "99+" : count}</span>}
    </button>
    {open && <div role="dialog" aria-label="Notifications" className="absolute right-0 top-12 z-50 w-[min(26rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl shadow-black/40"><NotificationCenter compact onNavigate={() => setOpen(false)}/></div>}
  </div>;
}
