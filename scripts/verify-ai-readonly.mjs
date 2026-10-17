// Start Spring, Go and the sibling AI service. Reads real MCP evidence only.
import assert from 'node:assert/strict';

const cases = [
  { portfolioId: 1, message: 'Explain order 1' },
  { portfolioId: 1, message: 'Explain moving averages and volatility for the selected period', researchContext: { assetId: 1, from: '2026-10-01', to: '2026-10-05', period: 14 } },
  { portfolioId: 1, message: 'What if the portfolio falls 10%?', researchContext: {} },
];
for (const body of cases) {
  const response = await fetch('http://127.0.0.1:3101/api/portfolio/chat', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body), signal: AbortSignal.timeout(45000),
  });
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.ok(data.reply);
  assert.doesNotMatch(data.reply, /^Authoritative research evidence is unavailable|^Order evidence is unavailable/i);
  if (body.message === 'Explain order 1') assert.match(data.reply, /^Order 1: FILLED/);
  else if (body.researchContext?.assetId) assert.match(data.reply, /^Fictional DEMO, .*fictional-history-v1/);
  else assert.match(data.reply, /^Hypothetical fictional portfolio 1/);
  assert.equal(data.model, null);
  console.log('PASS live MCP: ' + body.message + '\n' + data.reply);
}
