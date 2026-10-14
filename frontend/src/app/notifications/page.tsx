import NotificationCenter from "@/components/NotificationCenter";

export const metadata = { title: "Notifications | PortfolioLab" };

export default function NotificationsPage() {
  return <div className="space-y-5"><div><h2 className="text-2xl font-semibold text-white">Notification history</h2><p className="mt-2 text-sm text-slate-400">Trades, portfolio risk insights, and simulated dividends in one place.</p></div><div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900"><NotificationCenter /></div></div>;
}
