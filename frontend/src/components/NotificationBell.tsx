"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

type Notification = {
  id: number;
  eventId?: string;
  source: string;
  title: string;
  message: string;
  targetUrl?: string | null;
  createdAt: string;
  readAt?: string | null;
};

function BellIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
      <path d="M10 21h4" />
    </svg>
  );
}

function relativeTime(value: string) {
  const date = new Date(value);
  const diff = Date.now() - date.getTime();

  if (Number.isNaN(diff)) return "";

  if (diff < 60_000) return "Just now";

  const minutes = Math.floor(diff / 60_000);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  return `${Math.floor(hours / 24)}d ago`;
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  const refreshCount = useCallback(async () => {
    try {
      const response = await fetch(
        "/api/portfolio/notifications/unread-count",
        { cache: "no-store" }
      );

      if (!response.ok) return;

      const data = await response.json();

      const count =
        typeof data === "number"
          ? data
          : data.unreadCount ?? data.count ?? 0;

      setUnreadCount(Number(count) || 0);
    } catch {
      // The rest of the application remains usable if notifications fail.
    }
  }, []);

  const refreshNotifications = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        "/api/portfolio/notifications",
        { cache: "no-store" }
      );

      if (!response.ok) {
        throw new Error("Unable to load notifications");
      }

      const data = await response.json();

      if (!Array.isArray(data)) {
        throw new Error("Unexpected notification response");
      }

      setNotifications(data);
    } catch {
      setError("Notifications are temporarily unavailable.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshCount();

    const interval = window.setInterval(() => {
      if (!document.hidden) {
        void refreshCount();
      }
    }, 15_000);

    return () => window.clearInterval(interval);
  }, [refreshCount]);

  useEffect(() => {
    if (!open) return;

    void refreshNotifications();
    void refreshCount();
  }, [open, refreshNotifications, refreshCount]);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: PointerEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  async function markRead(id: number) {
    setUpdatingId(id);
    setError(null);

    try {
      const response = await fetch(
        `/api/portfolio/notifications/${id}/read`,
        { method: "PATCH" }
      );

      if (!response.ok) {
        throw new Error("Unable to update notification");
      }

      setNotifications((current) =>
        current.map((notification) =>
          notification.id === id
            ? { ...notification, readAt: new Date().toISOString() }
            : notification
        )
      );

      await refreshCount();
    } catch {
      setError("Could not mark notification as read.");
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-label={
          unreadCount > 0
            ? `Notifications, ${unreadCount} unread`
            : "Notifications"
        }
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((value) => !value)}
        className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-slate-700 bg-slate-900 text-slate-300 transition hover:border-slate-500 hover:bg-slate-800 hover:text-white"
      >
        <BellIcon />

        {unreadCount > 0 && (
          <span className="absolute -right-1.5 -top-1.5 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-emerald-500 px-1 text-[10px] font-bold text-slate-950">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <section
          role="dialog"
          aria-label="Notifications"
          className="absolute right-0 top-12 z-50 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl shadow-black/40"
        >
          <div className="flex items-center justify-between border-b border-slate-800 px-4 py-4">
            <div>
              <h2 className="text-sm font-semibold text-white">
                Notifications
              </h2>
              <p className="mt-1 text-xs text-slate-400">
                {unreadCount === 0
                  ? "You're all caught up"
                  : `${unreadCount} unread`}
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                void refreshNotifications();
                void refreshCount();
              }}
              className="rounded-lg px-2 py-1 text-xs text-emerald-400 hover:bg-slate-800"
            >
              Refresh
            </button>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {error && (
              <p role="alert" className="px-4 py-3 text-xs text-rose-400">
                {error}
              </p>
            )}

            {loading && notifications.length === 0 && (
              <p className="px-4 py-8 text-center text-sm text-slate-400">
                Loading notifications...
              </p>
            )}

            {!loading && !error && notifications.length === 0 && (
              <div className="px-5 py-10 text-center">
                <p className="text-sm font-medium text-slate-200">
                  No notifications yet
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  Your simulated trades will appear here.
                </p>
              </div>
            )}

            {notifications.map((notification) => {
              const unread = !notification.readAt;

              return (
                <div
                  key={notification.id}
                  className={`border-b border-slate-800/70 px-4 py-4 last:border-b-0 ${
                    unread ? "bg-emerald-500/[0.05]" : ""
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                        unread ? "bg-emerald-400" : "bg-slate-700"
                      }`}
                    />

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium text-slate-100">
                          {notification.title}
                        </p>

                        <span className="shrink-0 text-[11px] text-slate-500">
                          {relativeTime(notification.createdAt)}
                        </span>
                      </div>

                      <p className="mt-1 text-xs leading-relaxed text-slate-400">
                        {notification.message}
                      </p>

                      <div className="mt-3 flex items-center gap-4">
                        {notification.targetUrl?.startsWith("/") &&
                          !notification.targetUrl.startsWith("//") && (
                            <Link
                              href={notification.targetUrl}
                              onClick={() => setOpen(false)}
                              className="text-xs font-medium text-emerald-400 hover:text-emerald-300"
                            >
                              View portfolio
                            </Link>
                          )}

                        {unread && (
                          <button
                            type="button"
                            disabled={updatingId === notification.id}
                            onClick={() => void markRead(notification.id)}
                            className="text-xs text-slate-400 hover:text-white disabled:opacity-50"
                          >
                            {updatingId === notification.id
                              ? "Updating..."
                              : "Mark as read"}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="border-t border-slate-800 px-4 py-3">
            <p className="text-center text-[11px] text-slate-500">
              PortfolioLab · Simulated trading activity
            </p>
          </div>
        </section>
      )}
    </div>
  );
}