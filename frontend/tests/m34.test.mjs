import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { RecentOrderRow } from "../src/components/RecentOrders.tsx";
import { isActiveOrder, parseOrder, parseOrders, submitSimulatedOrder, cancelSimulatedOrder,
  cancelWithConfirmation, readOrders, OMS_PATH } from "../src/lib/simulated-orders.ts";
import { startOrderPolling } from "../src/lib/order-polling.ts";
import { GET as list, POST as submit } from "../src/app/api/portfolio/simulated-orders/route.ts";
import { GET as detail } from "../src/app/api/portfolio/simulated-orders/[orderId]/route.ts";
import { POST as cancel } from "../src/app/api/portfolio/simulated-orders/[orderId]/cancel/route.ts";
import { assessOrder } from "../src/components/orderAssessment.ts";

const order = (patch = {}) => ({ id: 12, portfolioId: 1, assetId: 3, side: "BUY", requestedQuantity: 10,
  filledQuantity: 0, status: "SUBMITTED", failureReason: null, ...patch });
const input = { assetId: 3, type: "BUY", quantity: 10 };
const request = body => new Request("http://localhost/api/portfolio/simulated-orders", {
  method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body)
});
const context = id => ({ params: Promise.resolve({ orderId: id }) });
const flush = () => new Promise(resolve => setImmediate(resolve));

test("submission proxy uses existing M31 contract and ignores caller portfolio overrides", async t => {
  const calls = [];
  t.mock.method(globalThis, "fetch", async (url, init) => {
    calls.push([url, init]); return Response.json(order(), { status: 201 });
  });
  const response = await submit(request({ ...input, portfolioId: 99 }));
  assert.equal(response.status, 201); assert.equal((await response.json()).status, "SUBMITTED");
  assert.match(calls[0][0], /\/api\/portfolios\/1\/simulated-orders$/);
  assert.equal(calls[0][1].method, "POST"); assert.deepEqual(JSON.parse(calls[0][1].body), input);
  assert.equal(response.headers.get("cache-control"), "no-store");
});
test("invalid submissions never reach backend", async t => {
  t.mock.method(globalThis, "fetch", () => assert.fail("Unexpected upstream request"));
  for (const body of [{}, null, { ...input, quantity: 0 }, { ...input, quantity: 1.5 },
    { ...input, quantity: 10_000_000_000_000 }, { ...input, type: "CANCEL" }, { ...input, assetId: -1 }]) {
    assert.equal((await submit(request(body))).status, 400);
  }
  assert.equal((await submit(new Request("http://localhost/", { method: "POST", body: "{" }))).status, 400);
});
test("list, detail and cancellation proxies preserve exact scoped paths and methods", async t => {
  const calls = [];
  t.mock.method(globalThis, "fetch", async (url, init) => {
    calls.push([url, init.method]);
    return Response.json(url.endsWith("/simulated-orders") ? [order()] : order());
  });
  assert.equal((await list()).status, 200);
  assert.equal((await detail(request({}), context("12"))).status, 200);
  assert.equal((await cancel(request({}), context("12"))).status, 200);
  assert.deepEqual(calls.map(([url, method]) => [url.split("/api/")[1], method]), [
    ["portfolios/1/simulated-orders", "GET"], ["portfolios/1/simulated-orders/12", "GET"],
    ["portfolios/1/simulated-orders/12/cancel", "POST"]
  ]);
  for (const id of ["0", "-1", "1.5", "9007199254740992", "12/cancel"]) {
    assert.equal((await detail(request({}), context(id))).status, 400);
    assert.equal((await cancel(request({}), context(id))).status, 400);
  }
  assert.equal(calls.length, 3);
});
test("proxy errors preserve HTTP status and withhold internal exception details", async t => {
  for (const status of [400, 404, 409, 500]) {
    t.mock.method(globalThis, "fetch", async () => new Response("private SQL stack secret", { status }));
    const response = await cancel(request({}), context("12"));
    assert.equal(response.status, status); assert.doesNotMatch(await response.text(), /private|SQL|secret/);
  }
  t.mock.method(globalThis, "fetch", async () => { throw Error("private network detail"); });
  assert.equal((await submit(request(input))).status, 503);
});
test("proxy rejects incorrect portfolio/order responses", async t => {
  for (const patch of [{ portfolioId: 2 }, { id: 99 }]) {
    t.mock.method(globalThis, "fetch", async () => Response.json(order(patch)));
    assert.equal((await detail(request({}), context("12"))).status, 503);
  }
});
test("client submission returns ID and status without synchronous settlement assumptions", async t => {
  t.mock.method(globalThis, "fetch", async (url, init) => {
    assert.equal(url, OMS_PATH); assert.equal(init.method, "POST");
    assert.deepEqual(JSON.parse(init.body), input); return Response.json(order(), { status: 201 });
  });
  const result = await submitSimulatedOrder(input);
  assert.equal(result.id, 12); assert.equal(result.status, "SUBMITTED"); assert.equal(result.filledQuantity, 0);
});
test("failed or uncertain submissions are never automatically retried", async t => {
  for (const failure of [400, 503, "network", "malformed", "mismatch"]) {
    let attempts = 0;
    t.mock.method(globalThis, "fetch", async () => {
      attempts++;
      if (failure === "network") throw Error("network");
      if (failure === "malformed") return Response.json({});
      if (failure === "mismatch") return Response.json(order({ assetId: 999 }));
      return new Response("failure", { status: failure });
    });
    await assert.rejects(submitSimulatedOrder(input), failure === 400 ? /not accepted/ : /Refresh Recent Orders/);
    assert.equal(attempts, 1);
  }
});

for (const [status, filled, active] of [["SUBMITTED", 0, true], ["ACCEPTED", 0, true],
  ["PARTIALLY_FILLED", 4, true], ["FILLED", 10, false], ["CANCELLED", 4, false], ["REJECTED", 0, false]]) {
  test(`${status}: persisted quantities render and cancellation eligibility is enforced`, async () => {
    const row = parseOrder(order({ status, filledQuantity: filled }));
    assert.equal(isActiveOrder(row), active);
    const html = renderToStaticMarkup(React.createElement(RecentOrderRow, {
      order: row, symbol: "DEMO", cancelling: null, onView() {}, onCancel() {}
    }));
    assert.match(html, new RegExp(status));
    assert.match(html, new RegExp(`<td class="p-2">${10 - filled}</td>`));
    const cancelButton = html.match(/<button[^>]*>Cancel #12<\/button>/)[0];
    assert.equal(cancelButton.includes("disabled" + '=\"\"'), !active);
    let confirmations = 0, sends = 0;
    const result = await cancelWithConfirmation(row, message => {
      confirmations++; assert.match(message, /remain settled/); assert.match(message, /More fills may occur/); return true;
    }, async id => { sends++; assert.equal(id, 12); return order({ status: "CANCELLED", filledQuantity: filled }); });
    assert.equal(confirmations, active ? 1 : 0); assert.equal(sends, active ? 1 : 0);
    assert.equal(result === null, !active);
  });
}
test("declining confirmation never sends a cancellation", async () => {
  assert.equal(await cancelWithConfirmation(order(), () => false, async () => assert.fail("Cancellation sent")), null);
});
test("cancellation race/conflict is reported; mutation is not retried", async t => {
  let sends = 0;
  t.mock.method(globalThis, "fetch", async (url, init) => {
    sends++; assert.equal(url, `${OMS_PATH}/12/cancel`); assert.equal(init.method, "POST");
    return new Response("already filled", { status: 409 });
  });
  await assert.rejects(cancelSimulatedOrder(12), /already terminal/); assert.equal(sends, 1);
});
test("partial cancellation displays retained fills and recorded business reason", () => {
  const row = parseOrder(order({ status: "CANCELLED", filledQuantity: 4, failureReason: "Insufficient virtual cash" }));
  const html = renderToStaticMarkup(React.createElement(RecentOrderRow, {
    order: row, symbol: "DEMO", cancelling: null, onView() {}, onCancel() {}
  }));
  assert.match(html, /Insufficient virtual cash/); assert.match(html, /<td class="p-2">4<\/td>/);
  assert.equal(parseOrder(order({ failureReason: "private SQL secret" })).failureReason.includes("secret"), false);
});
test("details always use exact GET; tracked active orders survive latest-100 eviction", async t => {
  const calls = [];
  t.mock.method(globalThis, "fetch", async (url, init) => {
    calls.push(url); assert.equal(init.cache, "no-store");
    if (url === OMS_PATH) return Response.json([order({ id: 200 })]);
    return Response.json(order({ id: Number(url.split("/").at(-1)), status: "FILLED", filledQuantity: 10 }));
  });
  const rows = await readOrders(new AbortController().signal, [order({ id: 12 })], 200);
  assert.deepEqual(new Set(calls), new Set([OMS_PATH, `${OMS_PATH}/12`, `${OMS_PATH}/200`]));
  assert.deepEqual(rows.map(o => o.id), [200, 12]); assert.equal(rows[1].status, "FILLED");
});
test("malformed, wrong-scope and failed read evidence never becomes a guessed order", async t => {
  assert.throws(() => parseOrder(order({ portfolioId: 9 })));
  assert.throws(() => parseOrders([order(), order()]));
  assert.equal(parseOrder(order({ filledQuantity: "4.000000" })).filledQuantity, 4);
  t.mock.method(globalThis, "fetch", async () => new Response("unavailable", { status: 503 }));
  await assert.rejects(readOrders(new AbortController().signal, [], null), /unavailable/);
});

function pollHarness(read, initial = [], overrides = {}) {
  const tasks = new Map(); let nextId = 0;
  const seen = [], errors = [];
  let refreshes = 0, pauses = 0;
  const stop = startOrderPolling({ read, initial, onSnapshot: rows => seen.push(rows),
    onPortfolioChange: async () => { refreshes++; }, onError: error => errors.push(error),
    onPaused: () => { pauses++; }, schedule: (callback, delay) => { assert.equal(delay, 3000); tasks.set(++nextId, callback); return nextId; },
    unschedule: id => tasks.delete(id), ...overrides });
  return { tasks, stop, seen, errors, get refreshes() { return refreshes; }, get pauses() { return pauses; },
    async advance() { await flush(); const first = tasks.entries().next().value; assert.ok(first, "Expected scheduled read"); tasks.delete(first[0]); first[1](); await flush(); } };
}
test("polling refreshes holdings/transactions after status or fills change, then stops at terminal", async () => {
  const states = [order(), order({ status: "ACCEPTED" }), order({ status: "PARTIALLY_FILLED", filledQuantity: 4 }),
    order({ status: "PARTIALLY_FILLED", filledQuantity: 4 }), order({ status: "FILLED", filledQuantity: 10 })];
  let index = 0;
  const h = pollHarness(async () => [states[index++]]);
  await flush(); assert.equal(h.refreshes, 0);
  await h.advance(); assert.equal(h.refreshes, 1);
  await h.advance(); assert.equal(h.refreshes, 2);
  await h.advance(); assert.equal(h.refreshes, 2);
  await h.advance(); assert.equal(h.refreshes, 3); assert.equal(h.tasks.size, 0);
  h.stop();
});
test("first observed completed fills refresh portfolio even without an earlier snapshot", async () => {
  const h = pollHarness(async () => [order({ status: "FILLED", filledQuantity: 10 })]);
  await flush(); assert.equal(h.refreshes, 1); assert.equal(h.tasks.size, 0); h.stop();
});
test("rejection and cancellation transitions stop polling and refresh state", async () => {
  for (const status of ["REJECTED", "CANCELLED"]) {
    const h = pollHarness(async () => [order({ status })], [order()]);
    await flush(); assert.equal(h.refreshes, 1); assert.equal(h.tasks.size, 0); h.stop();
  }
});
test("polling is bounded and manual restart is possible", async () => {
  const h = pollHarness(async () => [order()], [], { maxRequests: 2 });
  await h.advance(); assert.equal(h.pauses, 1); assert.equal(h.tasks.size, 0); h.stop();
  const restarted = pollHarness(async () => [order()]);
  await flush(); assert.equal(restarted.tasks.size, 1); restarted.stop(); assert.equal(restarted.tasks.size, 0);
});
test("repeated read failures pause without publishing an empty or guessed snapshot", async () => {
  const h = pollHarness(async () => { throw Error("offline"); });
  await h.advance(); await h.advance();
  assert.equal(h.pauses, 1); assert.equal(h.seen.length, 0); assert.equal(h.tasks.size, 0); h.stop();
});
test("cleanup aborts in-flight reads and prevents late state updates", async () => {
  let complete, signal;
  const h = pollHarness(incomingSignal => { signal = incomingSignal; return new Promise(resolve => { complete = resolve; }); });
  assert.equal(h.tasks.size, 0); h.stop(); assert.equal(signal.aborted, true);
  complete([order()]); await flush(); assert.equal(h.seen.length, 0); assert.equal(h.tasks.size, 0);
});
test("portfolio refresh failure retries refresh even after terminal order and keeps order information", async () => {
  let attempts = 0;
  const h = pollHarness(async () => [order({ status: "FILLED", filledQuantity: 10 })], [], {
    onPortfolioChange: async () => { if (++attempts === 1) throw Error("portfolio offline"); }
  });
  await flush(); assert.match(h.errors.at(-1), /holdings and transactions could not refresh/);
  assert.equal(h.seen[0][0].status, "FILLED"); await h.advance();
  assert.equal(attempts, 2); assert.equal(h.tasks.size, 0); h.stop();
});
test("normal TradeForm no longer calls legacy synchronous execution; preview remains", () => {
  const source = readFileSync(new URL("../src/components/TradeForm.tsx", import.meta.url), "utf8");
  assert.match(source, /await submitSimulatedOrder/);
  assert.doesNotMatch(source, /fetch\("\/api\/portfolio\/orders"/);
  assert.doesNotMatch(source, /executed:|Order executed/);
  assert.match(source, /\/api\/portfolio\/orders\/preview/);
  assert.match(source, /\/api\/ai\/agents\/business-rules\/evaluate/);
  assert.match(source, /Initial status:/);
  assert.match(source, /onOrdersChanged=\{onTradeCompleted\}/);
});
test("existing preview/risk assessment still blocks failed and stale review results", () => {
  assert.equal(assessOrder({ ruleStatus: "PASS", checks: [], side: "BUY", sufficientCash: false, stale: false }).status, "NOT_READY");
  assert.equal(assessOrder({ ruleStatus: "PASS", checks: [], side: "BUY", sufficientCash: true, stale: true }).status, "OUTDATED");
});
