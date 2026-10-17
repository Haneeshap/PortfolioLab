// Read-only browser smoke checks. Start real services first; no npm dependencies.
// Uses a disposable Chrome profile and never touches the user's normal browser.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const chromePath = process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
assert.ok(existsSync(chromePath), 'Set CHROME_PATH to an installed Chromium browser');
const profile = await mkdtemp(join(tmpdir(), 'portfoliolab-browser-'));
const chrome = spawn(chromePath, ['--headless=new', '--remote-debugging-port=0', '--remote-debugging-address=127.0.0.1', `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check', 'about:blank'], { windowsHide: true, stdio: 'ignore' });
let socket;
try {
  let port;
  for (let i = 0; i < 150; i++) {
    try { port = (await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; break; } catch { await delay(200); }
  }
  assert.ok(port, 'Chrome debugging endpoint did not start');
  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  socket = new WebSocket(targets.find(target => target.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  let sequence = 0;
  const pending = new Map();
  const exceptions = [];
  const pausedRequests = [];
  socket.onmessage = event => {
    const message = JSON.parse(event.data);
    if (message.method === 'Fetch.requestPaused') pausedRequests.push(message.params.requestId);
    if (message.method === 'Runtime.exceptionThrown') exceptions.push(message.params.exceptionDetails.exception?.description ?? message.params.exceptionDetails.text);
    const callback = pending.get(message.id);
    if (callback) { pending.delete(message.id); clearTimeout(callback.timer); message.error ? callback.reject(new Error(message.error.message)) : callback.resolve(message.result); }
  };
  function command(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = ++sequence;
      const timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, 30000);
      pending.set(id, { resolve, reject, timer }); socket.send(JSON.stringify({ id, method, params }));
    });
  }
  async function evaluate(expression) {
    const result = await command('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
    return result.result.value;
  }
  async function waitFor(expression) {
    for (let i = 0; i < 100; i++) { if (await evaluate(expression)) return; await delay(200); }
    throw new Error(`Browser condition timed out: ${expression}`);
  }
  await command('Runtime.enable'); await command('Page.enable');
  const health = await fetch('http://127.0.0.1:8080/api/health', { signal: AbortSignal.timeout(10000) });
  assert.equal(health.status, 200, 'Real backend must be healthy');
  for (const path of ['/', '/markets', '/portfolio', '/research', '/portfolio/risk', '/watchlists', '/alerts', '/notifications', '/activity', '/developer']) {
    await command('Page.navigate', { url: `http://localhost:3000${path}` });
    await waitFor(`location.pathname === ${JSON.stringify(path)} && document.readyState === 'complete' && !!document.querySelector('.pl-shell h1')`);
    console.log(`PASS browser navigation ${path}`);
  }
  await evaluate(`document.querySelector('[aria-label="dark theme"]').click()`);
  await waitFor(`document.documentElement.dataset.plTheme === 'dark'`);
  await command('Page.reload');
  await waitFor(`document.readyState === 'complete' && document.documentElement.dataset.plTheme === 'dark' && document.querySelector('[aria-label="dark theme"]').getAttribute('aria-pressed') === 'true'`);
  assert.equal(await evaluate(`localStorage.getItem('portfoliolab-theme')`), 'dark');
  console.log('PASS saved theme survives reload without being overwritten');
  await evaluate(`document.querySelector('[aria-label="Open command search"]').click()`);
  await waitFor(`document.activeElement?.getAttribute('aria-label') === 'Search pages'`);
  await evaluate(`document.dispatchEvent(new KeyboardEvent('keydown', {key:'Escape', bubbles:true}))`);
  await waitFor(`!document.querySelector('[role="dialog"][aria-label="Search workspace"]')`);
  await evaluate(`document.querySelector('[aria-label="Open command search"]').click()`);
  await waitFor(`document.activeElement?.getAttribute('aria-label') === 'Search pages' && document.activeElement.value === ''`);
  console.log('PASS command search opens, focuses, closes and resets');
  const assets = await (await fetch('http://127.0.0.1:8080/api/assets')).json();
  const assetId = assets.find(asset => asset.symbol === 'ORBIT').id;
  await command('Page.navigate', { url: `http://localhost:3000/portfolio?assetId=${assetId}` });
  await waitFor(`document.querySelector('#trade-asset')?.value === '${assetId}' && [...document.querySelectorAll('button')].some(button => button.textContent.trim() === 'Validate Order' && !button.disabled)`);
  console.log('PASS trade deep link selects the requested asset with live quotes');
  await command('Fetch.enable', { patterns: [{ urlPattern: '*/api/portfolio/orders/preview', requestStage: 'Request' }] });
  await evaluate(`[...document.querySelectorAll('button')].find(button => button.textContent.trim() === 'Validate Order').click()`);
  for (let i = 0; !pausedRequests.length && i < 100; i++) await delay(50);
  assert.ok(pausedRequests.length, 'Validation request was not intercepted');
  const quantityInput = value => `(() => { const input = document.querySelector('#trade-quantity'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, '${value}'); input.dispatchEvent(new Event('input', {bubbles:true})); })()`;
  await evaluate(quantityInput(2));
  await waitFor(`document.querySelector('#trade-quantity').value === '2' && ![...document.querySelectorAll('button')].some(button => button.textContent.trim() === 'Validating...')`);
  await evaluate(quantityInput(1));
  await waitFor(`document.querySelector('#trade-quantity').value === '1' && [...document.querySelectorAll('button')].some(button => button.textContent.trim() === 'Validate Order' && !button.disabled)`);
  await command('Fetch.disable');
  console.log('PASS changing and restoring order inputs cancels validation without leaving it stuck');
  assert.deepEqual(exceptions, [], 'Uncaught browser exceptions');
  console.log('PASS no uncaught JavaScript exceptions in visited pages');
} finally {
  socket?.close();
  chrome.kill();
  // Retain only this disposable profile for inspection; never remove user data.
}
