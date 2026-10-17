// Uses the actual repository, but never approves a Git write or uses a PAT.
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createAgent } from '../services/developer-agent/src/server.ts';
import { loadRepositories } from '../services/developer-agent/src/git.ts';
import { GitHub } from '../services/developer-agent/src/github.ts';

const repos = await loadRepositories([{ id: 'portfoliolab', name: 'PortfolioLab', path: fileURLToPath(new URL('../', import.meta.url)) }]);
const credential = randomBytes(32).toString('hex');
const server = createAgent({ repos, bootstrapCredential: credential, origin: 'http://localhost:3000', port: 4317, github: new GitHub() });
await new Promise((resolve, reject) => { server.once('error', reject); server.listen(4317, '127.0.0.1', resolve); });
let cookie = '', csrf = '';
async function request(action, input = {}) {
  return fetch(`http://127.0.0.1:4317/studio/${action}`, { method: 'POST', headers: { Origin: 'http://localhost:3000', 'Content-Type': 'application/json', Cookie: cookie, 'X-Studio-CSRF': csrf }, body: JSON.stringify({ repo: 'portfoliolab', ...input }), signal: AbortSignal.timeout(20000) });
}
try {
  assert.equal((await request('status')).status, 401);
  const response = await request('bootstrap', { credential }); assert.equal(response.status, 200);
  cookie = response.headers.get('set-cookie').split(';')[0]; csrf = (await response.json()).csrf;
  const catalog = await (await request('repos')).json(); assert.equal(catalog.githubConnected, false);
  const status = await request('status'); assert.equal(status.status, 200);
  assert.equal((await status.json()).branch, 'main');
  assert.equal((await request('stage', { paths: ['README.md'], approve: false })).status, 403);
  assert.equal((await request('bootstrap', { credential })).status, 401);
  console.log('PASS actual-repository bootstrap, read-only inspection without PAT, explicit approval denial and replay rejection');
} finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
