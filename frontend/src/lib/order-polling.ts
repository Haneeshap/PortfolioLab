import { isActiveOrder, type SimulatedOrder } from "./simulated-orders";

type PollOptions = {
  read: (signal: AbortSignal) => Promise<SimulatedOrder[]>;
  initial: SimulatedOrder[];
  onSnapshot: (orders: SimulatedOrder[]) => void;
  onPortfolioChange: () => Promise<void>;
  onError: (message: string | null) => void;
  onPaused: () => void;
  intervalMs?: number; maxRequests?: number; maxErrors?: number;
  schedule?: (callback: () => void, delay: number) => ReturnType<typeof setTimeout>;
  unschedule?: (timer: ReturnType<typeof setTimeout>) => void;
};
// A serial bounded loop: no overlapping requests, automatic mutation retries, or settlement logic.
export function startOrderPolling(options: PollOptions): () => void {
  let stopped = false, requests = 0, errors = 0, refreshNeeded = false;
  let previous = new Map(options.initial.map(order => [order.id, order]));
  let timer: ReturnType<typeof setTimeout> | undefined;
  const controller = new AbortController();
  const schedule = options.schedule ?? setTimeout;
  const unschedule = options.unschedule ?? clearTimeout;
  async function run() {
    requests++;
    let again = true;
    try {
      const orders = await options.read(controller.signal);
      if (stopped) return;
      errors = 0;
      refreshNeeded ||= orders.some(order => {
        const old = previous.get(order.id);
        return old ? old.status !== order.status || old.filledQuantity !== order.filledQuantity : order.filledQuantity > 0;
      });
      previous = new Map(orders.map(order => [order.id, order]));
      options.onSnapshot(orders);
      options.onError(null);
      if (refreshNeeded) {
        try { await options.onPortfolioChange(); refreshNeeded = false; }
        catch { if (!stopped) options.onError("Orders updated, but holdings and transactions could not refresh. Refresh again before trading."); }
      }
      again = orders.some(isActiveOrder) || refreshNeeded;
    } catch (error) {
      if (stopped) return;
      errors++;
      options.onError(error instanceof Error ? error.message : "Order status unavailable. Refresh to try again.");
    }
    if (stopped || !again) return;
    if (requests >= (options.maxRequests ?? 100) || errors >= (options.maxErrors ?? 3)) { options.onPaused(); return; }
    timer = schedule(() => { void run(); }, options.intervalMs ?? 3000);
  }
  void run();
  return () => { stopped = true; controller.abort(); if (timer !== undefined) unschedule(timer); };
}
