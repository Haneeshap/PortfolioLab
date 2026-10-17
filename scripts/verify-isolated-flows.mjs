// This opt-in check creates fictional data. Launch Spring with the same isolated
// database URL first; never use this against an existing development database.
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';

assert.ok(process.argv.includes('--allow-isolated-mutations'), 'Explicit --allow-isolated-mutations is required');
assert.match(process.env.SPRING_DATASOURCE_URL ?? '', /^jdbc:postgresql:\/\/(?:localhost|127\.0\.0\.1):5432\/m50_runtime_\d+$/, 'Set the same new isolated database URL used to launch Spring');
const base = 'http://localhost:3000';
async function api(path, body) {
  const response = await fetch(base + path, { method: body ? 'POST' : 'GET', headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(20000) });
  const text = await response.text();
  assert.ok(response.ok, `${path}: ${response.status} ${text}`);
  return text ? JSON.parse(text) : null;
}
const assets = await (await fetch('http://127.0.0.1:8080/api/assets')).json();
const asset = assets.find(value => value.symbol === 'ORBIT');
assert.ok(asset);
const order = { assetId: asset.id, type: 'BUY', quantity: 2, orderType: 'MARKET', timeInForce: 'GTC' };
const preview = await api('/api/portfolio/orders/preview', order);
assert.equal(preview.assetSymbol, 'ORBIT'); assert.equal(preview.sufficientCash, true);
console.log('PASS real order preview');
const submitted = await api('/api/portfolio/simulated-orders', order);
assert.ok(submitted.id); console.log(`PASS order submission ${submitted.id}`);
let settled;
for (let i = 0; i < 40; i++) {
  const value = await api(`/api/portfolio/simulated-orders/${submitted.id}`);
  if (value.status === 'FILLED') { settled = value; break; }
  assert.ok(!['FAILED', 'REJECTED', 'CANCELLED'].includes(value.status), JSON.stringify(value));
  await delay(2000);
}
assert.ok(settled, 'Order did not fill'); assert.equal(settled.filledQuantity, 2);
console.log('PASS order lifecycle reaches FILLED');
const portfolio = await api('/api/portfolio');
assert.ok(portfolio.holdings.some(value => value.assetId === asset.id && value.quantity >= 2));
assert.ok(portfolio.transactions.length); console.log('PASS holdings and transaction delivery');
const stream = await fetch(base + '/api/portfolio/simulated-orders/events', { headers: { 'Last-Event-ID': '0' }, signal: AbortSignal.timeout(20000) });
assert.equal(stream.status, 200); assert.match(stream.headers.get('content-type'), /event-stream/);
const reader = stream.body.getReader(); let events = ''; let matchedFill = false;
try {
  for (let i = 0; i < 200; i++) {
    const chunk = await reader.read();
    if (chunk.done) break;
    events += new TextDecoder().decode(chunk.value);
    matchedFill = events.replaceAll('\r\n', '\n').split('\n\n').some(frame => {
      const data = frame.split('\n').find(line => line.startsWith('data:'));
      if (!data) return false;
      try { const event = JSON.parse(data.slice(5)); return event.orderId === submitted.id && event.status === 'FILLED'; }
      catch { return false; }
    });
    if (matchedFill) break;
  }
} finally { await reader.cancel(); }
assert.ok(matchedFill, 'No FILLED event for this exact order'); console.log('PASS real order SSE replay');
const watch = await api('/api/portfolio/watchlists', { name: `M50 fictional verification ${Date.now()}` });
assert.ok(watch.id); await api(`/api/portfolio/watchlists/${watch.id}/items`, { symbol: 'ORBIT' });
assert.ok((await api('/api/portfolio/watchlists')).some(value => value.id === watch.id && value.symbols.includes('ORBIT')));
console.log('PASS watchlist creation and asset membership');
const quote = (await api('/api/market/prices')).find(value => value.symbol === 'ORBIT');
const alert = await api('/api/portfolio/price-alerts', { symbol: 'ORBIT', direction: 'ABOVE', targetPrice: Number((quote.price * 2).toFixed(4)) });
assert.equal(alert.status, 'ACTIVE'); console.log('PASS price alert creation');
const risk = await api('/api/portfolio/risk-lab', { broadShockPct: -10, assetShocks: {} });
assert.equal(risk.hypothetical, true); assert.ok(risk.projectedValue < risk.marketValue);
console.log('PASS read-only risk scenario with real holdings');
await api(`/api/research/assets/${asset.id}/history?from=2026-10-01&to=2026-10-05`);
console.log('PASS research history');
let notices = [];
for (let i = 0; i < 25; i++) {
  notices = await api('/api/portfolio/notifications');
  if (notices.some(value => value.targetUrl?.includes(`orderId=${submitted.id}`))) break;
  await delay(2000);
}
assert.ok(notices.some(value => value.targetUrl?.includes(`orderId=${submitted.id}`)), 'Kafka notification not delivered');
console.log('PASS outbox to Kafka to notification center');
assert.ok((await api('/api/portfolio/activity')).length); console.log('PASS activity timeline');
console.log('Fictional fixtures retained in the isolated runtime database. No deletion performed.');
