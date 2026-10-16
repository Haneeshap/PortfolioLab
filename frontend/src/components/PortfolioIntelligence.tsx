"use client";

import { useEffect, useRef, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Asset } from "@/app/assets";
import { formatMoney } from "./usePortfolioData";

type Point = { id: number; time: string; cash: number; marketValue: number; equity: number; verified: boolean };
type Attribution = { assetId: number; symbol: string; quantity: number; costBasis: number; lifetimeRealized: number | null; lifetimeUnrealized: number | null; lifetimeTotal: number | null; periodRealized: number | null; periodContribution: number | null; dividends: number | null };
type Performance = { currency: string; period: string; requestedFrom: string; asOf: string; earliestObservation: string | null; status: string; series: Point[]; startingValue: number | null; endingValue: number | null; absoluteChange: number | null; returnPct: number | null; attribution: Attribution[]; totals: { lifetimeRealized: number | null; lifetimeUnrealized: number | null; lifetimeTotal: number | null; periodContribution: number | null }; warnings: string[]; accountingMethod: string };
type Adjustment = { assetId: number; symbol: string; price: number; currentQuantity: number; currentPct: number | null; targetPct: number; side: string; quantity: number; notional: number; projectedQuantity: number; projectedPct: number | null; constraints: string[] };
type Plan = { currency: string; asOf: string; equity: number; cash: number; reservedCash: number; buyingPower: number; projectedCash: number; projectedCashPct: number | null; targetCashPct: number; feasible: boolean; adjustments: Adjustment[]; warnings: string[] };
const pct = (value: number | null) => value == null ? "Unavailable" : `${value.toFixed(2)}%`;
const date = (value: string) => new Date(value).toLocaleString("en-IN", { timeZone: "UTC" }) + " UTC";

export default function PortfolioIntelligence({ assets }: { assets: Asset[] }) {
  const [period, setPeriod] = useState("1M");
  const [data, setData] = useState<Performance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [targets, setTargets] = useState<Record<string, string>>({});
  const [cash, setCash] = useState("100");
  const [selected, setSelected] = useState("");
  const [plan, setPlan] = useState<Plan | null>(null);
  const [planning, setPlanning] = useState(false);
  const [planError, setPlanError] = useState("");
  const planRequest = useRef<AbortController | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/portfolio/intelligence?period=${period}`, { signal: controller.signal, cache: "no-store" })
      .then(async response => { const result = await response.json(); if (!response.ok) throw new Error(result.error); return result as Performance; })
      .then(result => { setData(result); setLoading(false); })
      .catch(reason => { if (!controller.signal.aborted) { setError(reason.message); setLoading(false); } });
    return () => controller.abort();
  }, [period, revision]);
  useEffect(() => () => planRequest.current?.abort(), []);
  function invalidate() { planRequest.current?.abort(); setPlanning(false); setPlan(null); setPlanError(""); }
  function refresh() { setLoading(true); setError(""); setData(null); setRevision(value => value + 1); invalidate(); }
  async function calculate() {
    const controller = new AbortController(); planRequest.current?.abort(); planRequest.current = controller;
    setPlanning(true); setPlanError(""); setPlan(null);
    try {
      const allocation = Object.fromEntries(Object.entries(targets).map(([id, value]) => [id, Number(value)]));
      if (!Number.isFinite(Number(cash)) || Object.values(allocation).some(value => !Number.isFinite(value))) throw new Error("Enter finite allocation percentages.");
      const response = await fetch("/api/portfolio/intelligence", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ assets: allocation, cashPct: Number(cash) }), signal: controller.signal });
      const result = await response.json(); if (!response.ok) throw new Error(result.error);
      if (!controller.signal.aborted) setPlan(result);
    } catch (reason) { if (!controller.signal.aborted) setPlanError(reason instanceof Error ? reason.message : "Plan unavailable"); }
    finally { if (!controller.signal.aborted) setPlanning(false); }
  }
  const money = (value: number | null, currency = data?.currency ?? "INR") => value == null ? "Unavailable" : formatMoney(value, currency);
  const total = Number(cash) + Object.values(targets).reduce((sum, value) => sum + Number(value), 0);
  const contributors = data?.attribution.filter(row => row.periodContribution != null).sort((a, b) => b.periodContribution! - a.periodContribution!) ?? [];
  return <section className="space-y-5 rounded-xl border border-slate-800 bg-slate-900 p-5" aria-label="Portfolio intelligence">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-2xl font-semibold">Performance & decisions</h2>
      <div className="flex gap-3"><select aria-label="Performance period" className="rounded bg-slate-800 p-2" value={period} onChange={event => { setPeriod(event.target.value); setLoading(true); setError(""); setData(null); }}>
        {["7D", "1M", "3M", "ALL"].map(value => <option key={value}>{value}</option>)}
      </select><button onClick={refresh} className="text-emerald-300 underline">Refresh</button></div>
    </div>
    {loading && <p role="status">Loading recorded performance…</p>}
    {error && <p role="alert" className="text-amber-300">{error}</p>}
    {data && !loading && <>
      <p className="text-sm text-slate-400">Coverage: {data.status.toLowerCase()}. Earliest observation: {data.earliestObservation ? date(data.earliestObservation) : "none"}.</p>
      {data.series.length === 0 ? <p>No observations in this period. Recorded history appears after the simulator and backend recorder run.</p> : <>
        <p className="text-sm text-slate-400">Observed interval: {date(data.series[0].time)} – {date(data.series[data.series.length - 1].time)}</p>
        <dl className="grid grid-cols-2 gap-4 lg:grid-cols-4">{[["Starting equity", money(data.startingValue)], ["Ending equity", money(data.endingValue)], ["Value change", money(data.absoluteChange)], ["Observed interval return", pct(data.returnPct)]].map(([label, value]) => <div key={label}><dt className="text-sm text-slate-400">{label}</dt><dd className="text-lg">{value}</dd></div>)}</dl>
        <div className="h-64" role="img" aria-label="Recorded portfolio equity, invested market value and cash over time">
          <ResponsiveContainer width="100%" height="100%"><LineChart data={data.series.map(point => ({ ...point, timestamp: new Date(point.time).getTime() }))}>
            <CartesianGrid stroke="#334155" strokeDasharray="3 3" /><XAxis dataKey="timestamp" type="number" domain={["dataMin", "dataMax"]} tickFormatter={value => new Date(value).toISOString().slice(5, 10)} /><YAxis domain={["auto", "auto"]} width={80} /><Tooltip labelFormatter={value => date(new Date(Number(value)).toISOString())} />
            <Line dataKey="equity" name="Total equity" stroke="#34d399" dot={data.series.length < 3} isAnimationActive={false} /><Line dataKey="marketValue" name="Invested value" stroke="#60a5fa" dot={false} isAnimationActive={false} /><Line dataKey="cash" name="Cash" stroke="#fbbf24" dot={false} isAnimationActive={false} />
          </LineChart></ResponsiveContainer>
        </div><p className="text-xs text-slate-400">Lines connect recorded observations; they do not supply missing daily valuations. Green: equity · blue: invested value · amber: cash.</p>
      </>}
      <details className="text-sm text-slate-400"><summary>Data coverage & accounting</summary><p>{data.accountingMethod}</p><ul className="ml-5 list-disc">{data.warnings.map((warning, i) => <li key={i}>{warning}</li>)}</ul></details>
      <h3 className="text-lg font-semibold">Attribution</h3>
      <dl className="grid grid-cols-2 gap-4 lg:grid-cols-4">{[["Lifetime realized", data.totals.lifetimeRealized], ["Current unrealized", data.totals.lifetimeUnrealized], ["Lifetime price P&L", data.totals.lifetimeTotal], ["Observed period contribution", data.totals.periodContribution]].map(([label, value]) => <div key={String(label)}><dt className="text-sm text-slate-400">{label}</dt><dd>{money(value as number | null)}</dd></div>)}</dl>
      <p className="text-sm text-slate-400" title="Period contribution = closing invested value − opening invested value − purchases + sales + recorded dividends. Lifetime unrealized uses current quotes, not the historical chart endpoint.">Period figures use the observed interval above. Lifetime figures include all settled activity through the current request; unrealized P&L uses current prices. Fees are not modeled.</p>
      {contributors.length > 0 && <p>Largest positive contributor: {contributors.find(row => row.periodContribution! > 0)?.symbol ?? "none"}. Largest detractor: {[...contributors].reverse().find(row => row.periodContribution! < 0)?.symbol ?? "none"}.</p>}
      {data.attribution.length === 0 ? <p>No settled positions to attribute.</p> : <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="text-slate-400"><tr>{["Position", "Remaining basis", "Lifetime realized", "Current unrealized", "Lifetime price P&L", "Period realized", "Period dividends", "Period contribution"].map(label => <th className="p-2" key={label}>{label}</th>)}</tr></thead><tbody>{data.attribution.map(row => <tr key={row.assetId} className="border-t border-slate-800"><td className="p-2">{row.symbol}{row.quantity === 0 ? " (closed)" : ""}</td>{[row.costBasis, row.lifetimeRealized, row.lifetimeUnrealized, row.lifetimeTotal, row.periodRealized, row.dividends, row.periodContribution].map((value, i) => <td className="p-2" key={i}>{money(value)}</td>)}</tr>)}</tbody></table></div>}
    </>}
    <details className="border-t border-slate-800 pt-4"><summary className="cursor-pointer text-lg font-semibold">Rebalancing planner</summary>
      <div className="mt-4 space-y-4">
        <p className="text-sm text-slate-400">Set targets including cash. Unlisted holdings target 0%. Preview uses current simulated prices and available resources. No orders are submitted.</p>
        <div className="flex flex-wrap gap-3"><select aria-label="Add fictional asset" className="max-w-full rounded bg-slate-800 p-2" value={selected} onChange={event => setSelected(event.target.value)}><option value="">Select asset</option>{assets.filter(asset => !(asset.id in targets)).map(asset => <option key={asset.id} value={asset.id}>{asset.symbol} — {asset.name}</option>)}</select><button disabled={!selected} onClick={() => { invalidate(); setTargets(previous => ({ ...previous, [selected]: "0" })); setSelected(""); }} className="text-emerald-300">Add target</button></div>
        {Object.entries(targets).map(([id, value]) => <div key={id} className="flex items-center gap-3"><label className="flex items-center gap-2">{assets.find(asset => asset.id === Number(id))?.symbol ?? id}<input aria-label={`Target allocation ${assets.find(asset => asset.id === Number(id))?.symbol ?? id}`} className="w-28 rounded bg-slate-800 p-2" type="number" min="0" max="100" step="0.0001" value={value} onChange={event => { invalidate(); setTargets(previous => ({ ...previous, [id]: event.target.value })); }} />%</label><button onClick={() => { invalidate(); setTargets(previous => Object.fromEntries(Object.entries(previous).filter(([key]) => key !== id))); }}>Remove</button></div>)}
        <label className="flex items-center gap-2">Target cash<input className="w-28 rounded bg-slate-800 p-2" type="number" min="0" max="100" step="0.0001" value={cash} onChange={event => { invalidate(); setCash(event.target.value); }} />%</label>
        <p>Total target: {Number.isFinite(total) ? total.toFixed(4) : "invalid"}%</p>
        <div className="flex gap-4"><button disabled={planning || !Number.isFinite(total) || Math.abs(total - 100) > 0.000100001} className="rounded bg-emerald-700 px-4 py-2 disabled:opacity-50" onClick={calculate}>{planning ? "Calculating…" : "Preview adjustments"}</button><button onClick={() => { invalidate(); setTargets({}); setCash("100"); }}>Reset to cash</button></div>
        {planError && <p role="alert" className="text-amber-300">{planError}</p>}
        {plan && <>
          <p role="status">{plan.feasible ? "Targets achievable at quoted estimates" : "Target drift remains — review constraints and rounding"}. Estimate as of {date(plan.asOf)}.</p>
          <p>Equity {money(plan.equity, plan.currency)} · cash {money(plan.cash, plan.currency)} · reserved {money(plan.reservedCash, plan.currency)} · buying power {money(plan.buyingPower, plan.currency)}</p>
          <p>Projected cash: {money(plan.projectedCash, plan.currency)} ({pct(plan.projectedCashPct)}); target {pct(plan.targetCashPct)}.</p>
          <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="text-slate-400"><tr>{["Asset", "Current → target → projected", "Allocation comparison", "Adjustment", "Estimated value", "Constraints"].map(label => <th className="p-2" key={label}>{label}</th>)}</tr></thead><tbody>{plan.adjustments.map(row => <tr key={row.assetId} className="border-t border-slate-800"><td className="p-2">{row.symbol}</td><td className="p-2">{pct(row.currentPct)} → {pct(row.targetPct)} → {pct(row.projectedPct)}</td><td className="min-w-32 p-2"><div title="Current allocation" className="mb-1 h-2 bg-blue-400" style={{ width: `${Math.max(0, Math.min(100, row.currentPct ?? 0))}%` }} /><div title="Target allocation" className="mb-1 h-2 bg-amber-400" style={{ width: `${row.targetPct}%` }} /><div title="Projected allocation" className="h-2 bg-emerald-400" style={{ width: `${Math.max(0, Math.min(100, row.projectedPct ?? 0))}%` }} /></td><td className="p-2">{row.side} {row.quantity} shares</td><td className="p-2">{money(row.notional, plan.currency)}</td><td className="p-2">{row.constraints.join("; ") || "No ticket constraints"}</td></tr>)}</tbody></table></div>
          <ul className="ml-5 list-disc text-sm text-slate-400">{plan.warnings.map(warning => <li key={warning}>{warning}</li>)}</ul>
        </>}
      </div>
    </details>
  </section>;
}
