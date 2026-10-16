"use client";

import { useEffect, useRef, useState } from "react";
import { cancelSimulatedOrder, cancelWithConfirmation, isActiveOrder, orderIsConsistent,
  readOrders, type SimulatedOrder } from "@/lib/simulated-orders";
import { startOrderUpdates } from "@/lib/order-updates";

const unfilled = (order: SimulatedOrder) => order.filledQuantity <= order.requestedQuantity
  ? order.requestedQuantity - order.filledQuantity : "Inconsistent";

export function RecentOrderRow({ order, symbol, cancelling, onView, onCancel }: {
  order: SimulatedOrder; symbol: string; cancelling: number | null;
  onView: (id: number) => void; onCancel: (order: SimulatedOrder) => void;
}) {
  return <tr className="border-t border-slate-800 align-top">
    <td className="p-2">#{order.id} · {symbol} · {order.side}<p>{order.orderType ?? "MARKET"} {order.limitPrice ?? ""} / {order.timeInForce ?? "GTC"}</p>{order.expiresAt && <p>Expires {new Date(order.expiresAt).toLocaleString()}</p>}</td>
    <td className="p-2"><span>{order.status}</span>
      {order.failureReason && <p className="mt-1 max-w-xs text-amber-300">{order.failureReason}</p>}
      {!orderIsConsistent(order) && <p className="text-amber-300">Status and quantities disagree. Ask AI to investigate order {order.id}.</p>}
    </td>
    <td className="p-2">{order.requestedQuantity}</td><td className="p-2">{order.filledQuantity}</td><td className="p-2">{unfilled(order)}</td>
    <td className="space-x-2 whitespace-nowrap p-2">
      <button type="button" disabled={cancelling !== null} onClick={() => onView(order.id)}
        className="underline disabled:opacity-50">Details #{order.id}</button>
      <button type="button" disabled={!isActiveOrder(order) || cancelling !== null} onClick={() => onCancel(order)}
        className="text-amber-300 underline disabled:opacity-40">{cancelling === order.id ? "Cancelling..." : `Cancel #${order.id}`}</button>
    </td>
  </tr>;
}

export default function RecentOrders({ submittedOrder, onOrdersChanged, assets }: {
  submittedOrder: SimulatedOrder | null;
  onOrdersChanged: () => Promise<void>;
  assets: { id: number; symbol: string }[];
}) {
  const [orders, setOrders] = useState<SimulatedOrder[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detailLoadedId, setDetailLoadedId] = useState<number | null>(null);
  const [generation, setGeneration] = useState(0);
  const [loading, setLoading] = useState(true);
  const [paused, setPaused] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState<number | null>(null);
  const snapshot = useRef<SimulatedOrder[]>([]);
  const stopPolling = useRef<() => void>(() => {});
  const onChange = useRef(onOrdersChanged);
  const mounted = useRef(false);
  useEffect(() => { onChange.current = onOrdersChanged; }, [onOrdersChanged]);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  useEffect(() => {
    const initial = snapshot.current;
    if (submittedOrder && !initial.some(order => order.id === submittedOrder.id)) {
      snapshot.current = [submittedOrder, ...initial];
      setOrders(snapshot.current);
    }
    setLoading(true);
    setPaused(false);
    stopPolling.current = startOrderUpdates({
      initial,
      read: signal => readOrders(signal, snapshot.current, selectedId),
      onSnapshot: rows => {
        setPaused(false);
        snapshot.current = rows;
        setOrders(rows);
        setLoading(false);
        setDetailLoadedId(selectedId);
      },
      onPortfolioChange: () => onChange.current(),
      onError: message => { setError(message); if (message) setLoading(false); },
      onPaused: () => { setPaused(true); setLoading(false); }
    });
    return () => stopPolling.current();
  }, [submittedOrder, selectedId, generation]);

  function refresh() { setGeneration(value => value + 1); }
  async function cancel(order: SimulatedOrder) {
    if (cancelling !== null) return;
    let attempted = false;
    try {
      await cancelWithConfirmation(order, message => window.confirm(message), async id => {
        attempted = true;
        // Prevent an older in-flight GET from overwriting the cancellation result.
        stopPolling.current();
        setCancelling(id);
        setError(null);
        const result = await cancelSimulatedOrder(id);
        if (mounted.current) setOrders(rows => rows.map(row => row.id === id ? result : row));
        return result;
      });
    } catch (failure) {
      if (mounted.current) setError(failure instanceof Error ? failure.message : "Cancellation could not be confirmed. Refresh its status.");
    } finally {
      if (mounted.current && attempted) { setCancelling(null); refresh(); }
    }
  }
  const selected = detailLoadedId === selectedId ? orders.find(order => order.id === selectedId) : undefined;
  const symbol = (id: number) => assets.find(asset => asset.id === id)?.symbol ?? `Asset ${id}`;

  return <section aria-label="Recent simulated orders" className="mt-6 border-t border-slate-700 pt-5">
    <div className="flex items-center justify-between gap-3">
      <h4 className="font-semibold">Recent Orders</h4>
      <button type="button" onClick={refresh} disabled={loading || cancelling !== null}
        className="rounded-lg border border-slate-600 px-3 py-2 text-sm disabled:opacity-50">Refresh orders</button>
    </div>
    <p className="mt-2 text-xs text-slate-400">Latest 100 M31 orders, plus orders being tracked. Submitted orders await execution; prices and buying power may change. Earlier fills remain settled after cancellation.</p>
    {loading && <p role="status" className="mt-3 text-sm text-slate-400">Loading order statuses...</p>}
    {paused && <p role="status" className="mt-3 text-sm text-amber-300">Fallback polling paused after its request limit or repeated failures. The live stream will reconnect; refresh orders to retry now.</p>}
    {error && <p role="alert" className="mt-3 text-sm text-red-300">{error}</p>}
    {!loading && !error && orders.length === 0 && <p className="mt-3 text-sm text-slate-400">No recent simulated orders.</p>}
    {orders.length > 0 && <div className="mt-3 max-h-80 overflow-auto">
      <table className="w-full text-left text-xs">
        <thead className="sticky top-0 bg-slate-900 text-slate-400"><tr>
          <th className="p-2">Order / Asset</th><th className="p-2">Status</th><th className="p-2">Requested</th>
          <th className="p-2">Filled</th><th className="p-2">Unfilled</th><th className="p-2">Actions</th>
        </tr></thead>
        <tbody>{orders.map(order => <RecentOrderRow key={order.id} order={order} symbol={symbol(order.assetId)} cancelling={cancelling}
          onView={id => { setDetailLoadedId(null); setSelectedId(id); refresh(); }} onCancel={row => { void cancel(row); }} />)}</tbody>
      </table>
    </div>}
    {selectedId !== null && <div className="mt-3 rounded-lg border border-slate-700 p-3 text-sm" aria-label={`Order ${selectedId} details`}>
      <div className="flex justify-between gap-3"><strong>Order #{selectedId}</strong>
        <button type="button" disabled={cancelling !== null} onClick={() => { setSelectedId(null); setDetailLoadedId(null); }} className="text-slate-400 underline disabled:opacity-40">Close details</button></div>
      {selected ? <>
        <p className="mt-2">{selected.side} {symbol(selected.assetId)} · {selected.status}</p>
        <p>Requested {selected.requestedQuantity}; filled {selected.filledQuantity}; unfilled {unfilled(selected)}.</p>
        <p className="mt-1 text-slate-400">{selected.failureReason ?? "No failure reason is available in the order response."}</p>
        {selected.status === "CANCELLED" && <p>The unfilled remainder is cancelled. Previously filled shares remain settled.</p>}
      </> : <p className="mt-2 text-slate-400">{error ? "Details could not be refreshed." : "Retrieving order details..."}</p>}
      <p className="mt-2 text-xs text-slate-400">Ask AI: “What happened to order {selectedId}?”</p>
    </div>}
    <p className="mt-3 text-xs text-slate-500">Legacy synchronous trades appear in Transaction History, outside this order list. Each M31 fill creates a settled transaction.</p>
  </section>;
}
