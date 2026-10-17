"use client";
import { useMarketPrices } from "@/components/MarketPriceProvider";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";

type Alert = { id: number; symbol: string; currency: string; direction: "ABOVE" | "BELOW"; targetPrice: number; status: string; createdAt: string; triggeredAt: string | null };
export default function AlertsPage() {
  const { prices, status } = useMarketPrices();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [symbol, setSymbol] = useState("ORBIT");
  useEffect(() => { const requested = new URLSearchParams(window.location.search).get("symbol"); if (requested && /^[A-Z0-9._-]{1,20}$/.test(requested)) { const timer = window.setTimeout(() => setSymbol(requested), 0); return () => window.clearTimeout(timer); } }, []);
  const [direction, setDirection] = useState<"ABOVE" | "BELOW">("ABOVE");
  const [target, setTarget] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [recentTrigger, setRecentTrigger] = useState<Alert | null>(null);
  const seen = useRef<Map<number, string> | null>(null);
  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/portfolio/price-alerts", { cache: "no-store" });
      if (!r.ok) throw Error();
      const next: Alert[] = await r.json();
      if (seen.current !== null) {
        const newlyTriggered = next.find(a => a.status === "TRIGGERED" && seen.current?.get(a.id) === "ACTIVE");
        if (newlyTriggered) setRecentTrigger(newlyTriggered);
      }
      seen.current = new Map(next.map(a => [a.id, a.status]));
      setAlerts(next);
    }
    catch { setError("Unable to load price alerts."); }
  }, []);
  useEffect(() => { void load(); const timer = setInterval(() => void load(), 3000); return () => clearInterval(timer); }, [load]);
  const quote = prices.find(p => p.symbol === symbol);
  async function create(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError(""); setSuccess("");
    try {
      const r = await fetch("/api/portfolio/price-alerts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ symbol, direction, targetPrice: Number(target) }) });
      const data = await r.json();
      if (!r.ok) throw new Error(data.detail || data.message || data.error || "Unable to create alert");
      setTarget(""); setSuccess("Price alert created. It will trigger once when the threshold is crossed."); await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to create alert"); }
    finally { setBusy(false); }
  }
  async function cancel(id: number) {
    setError(""); const r = await fetch(`/api/portfolio/price-alerts/${id}`, { method: "DELETE" });
    if (!r.ok) { setError("Unable to cancel alert"); return; } await load();
  }
  return <div className="space-y-6">
    <div><h2 className="text-2xl font-semibold">Market price alerts</h2><p className="mt-2 text-sm text-slate-400">Set one-time alerts for fictional market prices. This is not investment advice or a prediction.</p></div>
    <form onSubmit={create} className="grid gap-4 rounded-2xl border border-slate-800 bg-slate-900 p-5 md:grid-cols-4">
      <label className="space-y-2 text-sm">Asset<select value={symbol} onChange={e => { setSymbol(e.target.value); setTarget(""); }} className="block w-full rounded-lg border border-slate-700 bg-slate-950 p-3">{(prices.length ? prices : [{ symbol: "ORBIT", price: 0, currency: "INR", updatedAt: "" }]).map(p => <option key={p.symbol} value={p.symbol}>{p.symbol}</option>)}</select></label>
      <label className="space-y-2 text-sm">Crosses<select value={direction} onChange={e => { setDirection(e.target.value as "ABOVE" | "BELOW"); setTarget(""); }} className="block w-full rounded-lg border border-slate-700 bg-slate-950 p-3"><option value="ABOVE">Above</option><option value="BELOW">Below</option></select></label>
      <label className="space-y-2 text-sm">Target price<input type="number" min="0.0001" step="0.0001" required value={target} onChange={e => setTarget(e.target.value)} placeholder="Enter target" className="block w-full rounded-lg border border-slate-700 bg-slate-950 p-3"/></label>
      <div className="flex items-end"><button disabled={busy || status !== "connected"} className="w-full rounded-lg bg-emerald-500 p-3 font-semibold text-slate-950 disabled:opacity-50">{busy ? "Creating..." : "Create alert"}</button></div>
      <p className="text-xs text-slate-400 md:col-span-4">{quote ? `Current simulated price: ${quote.price.toFixed(4)} ${quote.currency}. Choose a target ${direction === "ABOVE" ? "higher" : "lower"} than this price.` : "Waiting for market connection..."}</p>
    </form>
    {recentTrigger && <div role="status" aria-live="polite" className="flex items-start justify-between gap-4 rounded-xl border border-emerald-500/50 bg-emerald-500/10 p-4 text-emerald-200"><div><p className="font-semibold">🔔 Price alert triggered!</p><p className="mt-1 text-sm">{recentTrigger.symbol} crossed {recentTrigger.direction === "ABOVE" ? "above" : "below"} {Number(recentTrigger.targetPrice).toFixed(4)} {recentTrigger.currency}.</p><p className="mt-1 text-xs text-emerald-300">{recentTrigger.triggeredAt ? new Date(recentTrigger.triggeredAt).toLocaleString() : "Just now"}</p></div><button type="button" onClick={() => setRecentTrigger(null)} className="rounded-lg border border-emerald-500/40 px-3 py-1 text-sm">Dismiss</button></div>}
    {error && <p role="alert" className="text-sm text-rose-400">{error}</p>}{success && <p className="text-sm text-emerald-400">{success}</p>}
    <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900"><div className="border-b border-slate-800 p-5"><h3 className="font-semibold">Your price alerts</h3></div>
      {!alerts.length ? <p className="p-5 text-sm text-slate-400">No alerts created yet.</p> : <div className="divide-y divide-slate-800">{alerts.map(a => <div key={a.id} className="flex flex-wrap items-center justify-between gap-4 p-5"><div><p className="font-medium">{a.symbol} {a.direction === "ABOVE" ? "↑ Above" : "↓ Below"} {Number(a.targetPrice).toFixed(4)} {a.currency}</p><div className="mt-2 flex flex-wrap items-center gap-2"><span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${a.status === "TRIGGERED" ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300" : a.status === "ACTIVE" ? "border-amber-500/40 bg-amber-500/10 text-amber-300" : "border-slate-700 bg-slate-800 text-slate-400"}`}>{a.status === "TRIGGERED" ? "✓ Triggered" : a.status === "ACTIVE" ? "● Watching" : a.status}</span><span className="text-xs text-slate-400">Created {new Date(a.createdAt).toLocaleString()}</span></div>{a.status === "TRIGGERED" && <p className="mt-2 text-sm font-medium text-emerald-300">🔔 Triggered {a.triggeredAt ? new Date(a.triggeredAt).toLocaleString() : "(time unavailable)"}</p>}</div>{a.status === "ACTIVE" && <button onClick={() => void cancel(a.id)} className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 hover:bg-slate-800">Cancel</button>}</div>)}</div>}
    </section>
  </div>;
}
