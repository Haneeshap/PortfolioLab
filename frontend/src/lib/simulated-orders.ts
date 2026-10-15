export const DEMO_PORTFOLIO_ID = 1;
export const OMS_PATH = "/api/portfolio/simulated-orders";
export const ORDER_STATUSES = ["SUBMITTED", "ACCEPTED", "PARTIALLY_FILLED", "FILLED", "CANCELLED", "REJECTED"] as const;
export type OrderStatus = typeof ORDER_STATUSES[number];
export type SimulatedOrder = {
  id: number; portfolioId: number; assetId: number; side: "BUY" | "SELL";
  requestedQuantity: number; filledQuantity: number; status: OrderStatus;
  failureReason: string | null;
};
export type OrderInput = { assetId: number; type: "BUY" | "SELL"; quantity: number };
export function validId(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}
export function validOrderInput(value: unknown): value is OrderInput {
  if (!value || typeof value !== "object") return false;
  const input = value as Record<string, unknown>;
  return validId(input.assetId) && (input.type === "BUY" || input.type === "SELL") &&
    validId(input.quantity) && input.quantity <= 9_999_999_999_999;
}
function quantity(value: unknown): number {
  const number = typeof value === "string" && /^\d+(?:\.0+)?$/.test(value) ? Number(value) : value;
  if (typeof number !== "number" || !Number.isSafeInteger(number) || number < 0) throw Error("Invalid order quantity");
  return number;
}
export function parseOrder(value: unknown, orderId?: number): SimulatedOrder {
  if (!value || typeof value !== "object") throw Error("Invalid OMS response");
  const row = value as Record<string, unknown>;
  if (!validId(row.id) || row.portfolioId !== DEMO_PORTFOLIO_ID || !validId(row.assetId) ||
      (orderId !== undefined && row.id !== orderId) || (row.side !== "BUY" && row.side !== "SELL") ||
      !ORDER_STATUSES.includes(row.status as OrderStatus) ||
      !(row.failureReason === null || typeof row.failureReason === "string")) throw Error("Invalid OMS response");
  const requestedQuantity = quantity(row.requestedQuantity);
  const filledQuantity = quantity(row.filledQuantity);
  if (requestedQuantity <= 0) throw Error("Invalid OMS response");
  return { id: row.id, portfolioId: DEMO_PORTFOLIO_ID, assetId: row.assetId, side: row.side,
    requestedQuantity, filledQuantity, status: row.status as OrderStatus,
    failureReason: safeFailureReason(row.failureReason as string | null) };
}
export function parseOrders(value: unknown): SimulatedOrder[] {
  if (!Array.isArray(value) || value.length > 100) throw Error("Invalid recent orders response");
  const rows = value.map(row => parseOrder(row));
  if (new Set(rows.map(row => row.id)).size !== rows.length) throw Error("Duplicate order IDs");
  return rows;
}
const withheld = "A failure reason is recorded; internal details are withheld.";
export function safeFailureReason(reason: string | null): string | null {
  if (!reason?.trim()) return null;
  if (["Insufficient virtual cash", "Insufficient holdings", "Order rejected by settlement"].includes(reason) ||
      /^Pre-trade risk rejected order: (MAX_ORDER_VALUE|MAX_POSITION_COST_CONCENTRATION)(, (MAX_ORDER_VALUE|MAX_POSITION_COST_CONCENTRATION))*$/.test(reason)) return reason;
  return withheld;
}
export function isActiveOrder(order: SimulatedOrder): boolean {
  return ["SUBMITTED", "ACCEPTED", "PARTIALLY_FILLED"].includes(order.status);
}
export function orderIsConsistent(order: SimulatedOrder): boolean {
  const filled = order.filledQuantity, requested = order.requestedQuantity;
  if (filled > requested) return false;
  if (order.status === "FILLED") return filled === requested;
  if (order.status === "PARTIALLY_FILLED") return filled > 0 && filled < requested;
  if (["SUBMITTED", "ACCEPTED", "REJECTED"].includes(order.status)) return filled === 0;
  return true;
}
export function cancellationPrompt(order: SimulatedOrder): string {
  return `Cancel the unfilled remainder of simulated order ${order.id}? ${order.filledQuantity} shares have already filled and will remain settled. More fills may occur before cancellation is confirmed.`;
}
export async function cancelWithConfirmation(order: SimulatedOrder, confirm: (message: string) => boolean,
  send: (id: number) => Promise<SimulatedOrder>): Promise<SimulatedOrder | null> {
  if (!isActiveOrder(order) || !confirm(cancellationPrompt(order))) return null;
  return send(order.id);
}
export async function readOrders(signal: AbortSignal, tracked: SimulatedOrder[], selectedId: number | null): Promise<SimulatedOrder[]> {
  signal = AbortSignal.any([signal, AbortSignal.timeout(15000)]);
  const response = await fetch(OMS_PATH, { signal, cache: "no-store" });
  if (!response.ok) throw Error("Recent orders unavailable. Previously displayed statuses may be outdated.");
  const rows = parseOrders(await response.json());
  // Continue tracking active orders even if newer submissions push them outside the latest 100.
  const ids = new Set(tracked.filter(isActiveOrder).filter(o => !rows.some(row => row.id === o.id)).map(o => o.id));
  if (selectedId !== null) ids.add(selectedId);
  const details = await Promise.all([...ids].map(async id => {
    const detail = await fetch(`${OMS_PATH}/${id}`, { signal, cache: "no-store" });
    if (!detail.ok) throw Error(`Order ${id} details unavailable. Refresh to try again.`);
    return parseOrder(await detail.json(), id);
  }));
  return [...rows.filter(row => !ids.has(row.id)), ...details].sort((a, b) => b.id - a.id);
}
export async function submitSimulatedOrder(input: OrderInput): Promise<SimulatedOrder> {
  if (!validOrderInput(input)) throw Error("Invalid simulated order inputs.");
  let response: Response;
  try {
    response = await fetch(OMS_PATH, { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input), signal: AbortSignal.timeout(15000) });
  } catch { throw Error("Submission outcome is unknown. Refresh Recent Orders before submitting again; an order may already exist."); }
  if (!response.ok) throw Error(response.status >= 500
    ? "Submission outcome is unknown. Refresh Recent Orders before submitting again; an order may already exist."
    : `Submission was not accepted (${response.status}). Review the inputs and refresh Recent Orders.`);
  try {
    const order = parseOrder(await response.json());
    if (order.assetId !== input.assetId || order.side !== input.type || order.requestedQuantity !== input.quantity) throw Error();
    return order;
  } catch { throw Error("Submission returned an unexpected response. Refresh Recent Orders before submitting again; an order may already exist."); }
}
export async function cancelSimulatedOrder(id: number): Promise<SimulatedOrder> {
  if (!validId(id)) throw Error("Invalid order ID.");
  let response: Response;
  try {
    response = await fetch(`${OMS_PATH}/${id}/cancel`, { method: "POST", signal: AbortSignal.timeout(15000) });
  } catch { throw Error("Cancellation outcome is unknown. Refresh the order before trying again."); }
  if (!response.ok) throw Error(response.status === 409 ? "The order is already terminal. Refresh to see the latest status."
    : "Cancellation could not be confirmed. Refresh the order before trying again.");
  return parseOrder(await response.json(), id);
}
