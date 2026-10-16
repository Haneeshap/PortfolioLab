import { DEMO_PORTFOLIO_ID, parseOrder, parseOrders, validId, validOrderInput } from "./simulated-orders";

const headers = { "Cache-Control": "no-store" };
const reply = (body: unknown, status: number) => Response.json(body, { status, headers });
async function forward(method: "GET" | "POST", orderId?: number, cancel = false, body?: unknown) {
  const backend = process.env.BACKEND_URL ?? "http://localhost:8080";
  const suffix = orderId === undefined ? "" : `/${orderId}${cancel ? "/cancel" : ""}`;
  try {
    const response = await fetch(`${backend}/api/portfolios/${DEMO_PORTFOLIO_ID}/simulated-orders${suffix}`, {
      method, headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined, cache: "no-store", redirect: "error",
      signal: AbortSignal.timeout(10000)
    });
    if (!response.ok) return reply({ error: response.status === 404 ? "Order or portfolio not found."
      : response.status === 409 ? "Order is already terminal. Refresh its status."
      : response.status >= 500 ? "OMS unavailable. A submitted action may already have completed; refresh before retrying."
      : "OMS rejected this request." }, response.status);
    const data: unknown = await response.json();
    return reply(method === "GET" && orderId === undefined ? parseOrders(data) : parseOrder(data, orderId), response.status);
  } catch {
    return reply({ error: "OMS outcome unavailable. Refresh Recent Orders before retrying any submission or cancellation." }, 503);
  }
}
export async function listOrdersProxy() { return forward("GET"); }
export async function submitOrderProxy(request: Request) {
  let body: unknown;
  try { body = await request.json(); } catch { return reply({ error: "Invalid JSON request." }, 400); }
  if (!validOrderInput(body)) return reply({ error: "Invalid asset, side, or whole-share quantity (maximum 13 digits)." }, 400);
  return forward("POST", undefined, false, { assetId: body.assetId, type: body.type, quantity: body.quantity, orderType: body.orderType, limitPrice: body.limitPrice, timeInForce: body.timeInForce });
}
export async function orderProxy(rawId: string, cancel = false) {
  if (!/^[1-9]\d*$/.test(rawId) || !validId(Number(rawId))) return reply({ error: "Invalid order ID." }, 400);
  return forward(cancel ? "POST" : "GET", Number(rawId), cancel);
}
