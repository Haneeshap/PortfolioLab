import NotificationCenter from "@/components/NotificationCenter";

import NotificationPreferences from "@/components/NotificationPreferences";

export const metadata = { title: "Notifications | PortfolioLab" };

export default function NotificationsPage() {
  return <div className="space-y-5"><div><h2 className="text-2xl font-semibold text-white">Notification history</h2><p className="mt-2 text-sm text-slate-400">Simulated order updates, price alerts, insights and dividends. Notices retained for 90 days.</p></div><NotificationPreferences/><div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900"><NotificationCenter /></div></div>;
}
