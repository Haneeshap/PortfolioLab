import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, mkdir, rm, rename, symlink, readFile, cp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { git, loadRepositories, overview, diff, stage, prepareCommit, commit, safePath, parseStatus, type Repo } from '../src/git.ts';
import { GitHub, githubRepo, preparePush, push } from '../src/github.ts';
import { redact, sensitivePath } from '../src/security.ts';
import { createAgent } from '../src/server.ts';
import { readTool, analyze, toolNames } from '../src/analysis.ts';

function raw(path: string, ...args: string[]) { return execFileSync('git', args, { cwd: path, encoding: 'utf8', windowsHide: true, env: { ...process.env, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: process.platform === 'win32' ? 'NUL' : '/dev/null' } }).trim(); }
async function fixture(fn: (repo: Repo) => Promise<void>) {
  const path = await mkdtemp(join(tmpdir(), 'studio-test-'));
  try {
    raw(path, 'init', '-b', 'main'); raw(path, 'config', 'user.name', 'Studio Test'); raw(path, 'config', 'user.email', 'studio@example.invalid');
    await writeFile(join(path, 'file.txt'), 'one\ntwo\n'); raw(path, 'add', '--', 'file.txt'); raw(path, 'commit', '-m', 'initial');
    const [repo] = await loadRepositories([{ id: 'fixture', name: 'Fixture', path }]); await fn(repo);
  } finally { await rm(path, { recursive: true, force: true }); }
}
test('status covers clean, modified, partial stage, untracked, deleted, renamed and binary', async () => fixture(async repo => {
  assert.equal((await overview(repo)).clean, true);
  await writeFile(join(repo.path, 'file.txt'), 'one\nchanged\n'); await writeFile(join(repo.path, 'new.txt'), 'new\n');
  let state = await overview(repo); assert.equal(state.counts.untracked, 1); assert.equal(state.counts.unstaged, 1);
  await stage(repo, ['file.txt']); await writeFile(join(repo.path, 'file.txt'), 'one\nchanged\nthird\n');
  state = await overview(repo); assert.equal(state.files.find(f => f.path === 'file.txt')?.staged, true); assert.equal(state.files.find(f => f.path === 'file.txt')?.unstaged, true);
  assert.match((await diff(repo, 'file.txt', 'staged')).text, /\+changed/); assert.doesNotMatch((await diff(repo, 'file.txt', 'staged')).text, /\+third/);
  assert.match((await diff(repo, 'file.txt', 'unstaged')).text, /\+third/);
  await stage(repo, ['file.txt'], true); assert.equal((await overview(repo)).counts.staged, 0);
  await writeFile(join(repo.path, 'image.bin'), Buffer.from([0, 1, 2])); assert.equal((await diff(repo, 'image.bin', 'unstaged')).binary, true);
  await writeFile(join(repo.path, 'file.txt'), 'one\ntwo\n'); await rename(join(repo.path, 'file.txt'), join(repo.path, 'renamed.txt')); raw(repo.path, 'add', '--', 'file.txt', 'renamed.txt');
  assert.equal((await overview(repo)).files.some(f => f.index === 'R'), true);
  await rm(join(repo.path, 'renamed.txt')); assert.equal((await overview(repo)).files.some(f => f.worktree === 'D'), true);
}));
test('snapshot rejects stale staging, commits exact staged tree, preserves unstaged edits', async () => fixture(async repo => {
  await assert.rejects(prepareCommit(repo), /No staged/);
  await writeFile(join(repo.path, 'file.txt'), 'approved\n'); await stage(repo, ['file.txt']);
  const review = await prepareCommit(repo);
  await writeFile(join(repo.path, 'file.txt'), 'later worktree edit\n');
  const result = await commit(repo, review.snapshot, 'feat: reviewed snapshot', 'Body'); assert.match(result.sha, /^[a-f0-9]{40,64}$/);
  assert.equal(raw(repo.path, 'show', 'HEAD:file.txt'), 'approved'); assert.equal((await overview(repo)).counts.unstaged, 1);
  await stage(repo, ['file.txt']); const stale = await prepareCommit(repo); await writeFile(join(repo.path, 'file.txt'), 'different\n'); await stage(repo, ['file.txt']);
  const before = raw(repo.path, 'rev-parse', 'HEAD'); await assert.rejects(commit(repo, stale.snapshot, 'fix: stale'), /changed/); assert.equal(raw(repo.path, 'rev-parse', 'HEAD'), before);
  await assert.rejects(commit(repo, stale.snapshot, ''), /title/); await assert.rejects(commit(repo, stale.snapshot, 'bad\nmessage'), /title/);
  await writeFile(join(repo.gitDir, 'index.lock'), ''); await assert.rejects(commit(repo, stale.snapshot, 'fix: lock'), /locked/); await rm(join(repo.gitDir, 'index.lock'));
}));
test('branch changes invalidate snapshots and detached HEAD is rejected', async () => fixture(async repo => {
  await writeFile(join(repo.path, 'file.txt'), 'changed\n'); await stage(repo, ['file.txt']); const r = await prepareCommit(repo);
  raw(repo.path, 'branch', 'other'); raw(repo.path, 'symbolic-ref', 'HEAD', 'refs/heads/other'); await assert.rejects(commit(repo, r.snapshot, 'fix: wrong branch'), /changed/);
  raw(repo.path, 'reset', '--hard', 'HEAD'); raw(repo.path, 'checkout', '--detach'); await assert.rejects(prepareCommit(repo), /Detached/);
}));
test('merge conflicts block commits', async () => fixture(async repo => {
  raw(repo.path, 'checkout', '-b', 'other'); await writeFile(join(repo.path, 'file.txt'), 'other\n'); raw(repo.path, 'commit', '-am', 'other');
  raw(repo.path, 'checkout', 'main'); await writeFile(join(repo.path, 'file.txt'), 'main\n'); raw(repo.path, 'commit', '-am', 'main');
  assert.throws(() => raw(repo.path, 'merge', 'other')); assert.equal((await overview(repo)).files[0].conflict, true); await assert.rejects(prepareCommit(repo), /conflict/);
}));
test('literal filenames, traversal, Git internals and directory symlinks', async () => fixture(async repo => {
  for (const path of ['../outside', '.git/config', '.GIT. /config', 'file:stream', 'a/../../outside', 'C:\\outside', '/outside', 'a\\b']) await assert.rejects(safePath(repo, path));
  await writeFile(join(repo.path, '[odd].txt'), 'literal'); await stage(repo, ['[odd].txt']); assert.equal((await overview(repo)).counts.staged, 1);
  await assert.rejects(stage(repo, ['not-changed.txt']), /current changed/);
  await symlink(tmpdir(), join(repo.path, 'escape'), process.platform === 'win32' ? 'junction' : 'dir'); await assert.rejects(safePath(repo, 'escape/leak.txt'), /Symlinks/);
  await assert.rejects(loadRepositories([{ id: 'bad', name: 'bad', path: join(repo.path, '.git') }]));
}));
test('status parser preserves rename and unusual filenames', () => {
  const files = parseStatus('R  new name.txt\0old name.txt\0?? line\nbreak.txt\0UU conflict\0'); assert.equal(files[0].oldPath, 'old name.txt'); assert.equal(files[1].path, 'line\nbreak.txt'); assert.equal(files[2].conflict, true);
});
test('first commit and partially staged unstage on an unborn branch', async () => {
  const path = await mkdtemp(join(tmpdir(), 'studio-unborn-'));
  try {
    raw(path, 'init', '-b', 'main'); raw(path, 'config', 'user.name', 'Test'); raw(path, 'config', 'user.email', 'test@example.invalid');
    const [repo] = await loadRepositories([{ id: 'new', name: 'New', path }]);
    await writeFile(join(path, 'initial.txt'), 'first'); await stage(repo, ['initial.txt']); await writeFile(join(path, 'initial.txt'), 'later');
    await stage(repo, ['initial.txt'], true); assert.equal(await readFile(join(path, 'initial.txt'), 'utf8'), 'later'); assert.equal((await overview(repo)).counts.staged, 0);
    await stage(repo, ['initial.txt']); const review = await prepareCommit(repo); const result = await commit(repo, review.snapshot, 'feat: first commit'); assert.equal(raw(path, 'rev-parse', 'HEAD'), result.sha);
  } finally { await rm(path, { recursive: true, force: true }); }
});
test('Git askpass retrieves session credential through fixed helper without network', async () => fixture(async repo => {
  const value = await git(repo, ['-c', 'credential.helper=', 'credential', 'fill'], { input: 'protocol=https\nhost=github.com\n\n', env: {
    GIT_ASKPASS: fileURLToPath(new URL('../src/askpass.sh', import.meta.url)),
    STUDIO_NODE: process.execPath, STUDIO_ASKPASS_SCRIPT: fileURLToPath(new URL('../src/askpass.cjs', import.meta.url)), STUDIO_GITHUB_TOKEN: 'github_pat_test_fixture'
  } });
  assert.match(value, /username=x-access-token/); assert.match(value, /password=github_pat_test_fixture/);
}));
test('redaction and MCP isolation exclude credentials; unknown tools cannot write', async () => fixture(async repo => {
  const secret = 'github_pat_abcdefghijklmnopqrstuvwxyz'; const source = `token=${secret}\npassword: private-value\n-----BEGIN PRIVATE KEY-----\ncontents\n-----END PRIVATE KEY-----`;
  const clean = redact(source); assert.ok(!clean.includes(secret) && !clean.includes('private-value') && !clean.includes('contents'));
  assert.equal(sensitivePath('.env.local'), true);
  await writeFile(join(repo.path, '.env.local'), source); const result = await readTool(repo, new GitHub(), 'get_file_diff', { path: '.env.local' }); assert.equal((result as { excluded: boolean }).excluded, true);
  await assert.rejects(readTool(repo, new GitHub(), 'commit', {}), /not allowed/); assert.ok(!toolNames.some(t => /^(commit|push|stage)$/.test(t)));
  const fallback = await analyze(repo, new GitHub(), { scope: 'summary' }, new AbortController().signal, undefined); assert.equal(fallback.source, 'deterministic'); assert.ok(!JSON.stringify(fallback).includes(secret));
}));
test('push review rejects missing/unsafe origin without contacting network', async () => fixture(async repo => {
  assert.equal((await overview(repo)).upstream, null); await assert.rejects(preparePush(repo, new GitHub()));
  raw(repo.path, 'remote', 'add', 'origin', 'file:///tmp/remote'); await assert.rejects(preparePush(repo, new GitHub()), /https/);
  for (const url of ['https://user:token@github.com/org/repo', 'https://evil.example/org/repo', 'git@github.com:org/repo.git', 'https://github.com/../repo']) assert.throws(() => githubRepo(url));
  assert.equal(githubRepo('https://github.com/org/repo.git').name, 'repo');
  raw(repo.path, 'remote', 'set-url', 'origin', 'https://github.com/test/repo.git');
  raw(repo.path, 'config', 'url.https://evil.invalid/.insteadOf', 'https://github.com/');
  await assert.rejects(preparePush(repo, new GitHub(), undefined, async () => { throw new Error('Transport must not run'); }), /transport overrides/);
}));
test('GitHub maps real run states, failed jobs, empty CI, permission/rate/network errors', async () => fixture(async repo => {
  raw(repo.path, 'remote', 'add', 'origin', 'https://github.com/test/repo.git');
  const calls: string[] = [];
  const client = new GitHub('test-token', (async (url: string | URL | Request, options?: RequestInit) => {
    calls.push(String(url)); assert.equal((options?.headers as Record<string, string>).Authorization, 'Bearer test-token');
    return new Response(JSON.stringify(String(url).includes('/jobs?') ? { total_count: 1, jobs: [{ id: 1, name: 'Tests', status: 'completed', conclusion: 'failure', html_url: 'https://github.com/test/repo/actions/runs/1', steps: [{ number: 1, name: 'Run tests', status: 'completed', conclusion: 'failure' }] }] } : { workflow_runs: ['queued', 'in_progress', 'completed'].map((status, id) => ({ id, name: 'CI', head_branch: 'main', head_sha: 'a'.repeat(40), status, conclusion: status === 'completed' ? 'success' : null, html_url: 'https://github.com/test/repo/actions/runs/1' })) }), { status: 200 });
  }) as typeof fetch);
  const runs = await client.runs(repo, 'a'.repeat(40)); assert.equal(runs.runs[0].status, 'queued'); assert.equal(runs.runs[2].conclusion, 'success'); assert.match(calls[0], /head_sha=/);
  const jobs = await client.details(repo, 1); assert.equal(jobs.failures[0].step, 'Run tests');
  const empty = new GitHub('', (async () => new Response('{"workflow_runs":[]}')) as typeof fetch); assert.equal((await empty.runs(repo)).runs.length, 0);
  for (const [status, message] of [[401, /invalid or expired/], [403, /denied access/], [429, /rate limit/], [404, /unavailable/]] as const) { const c = new GitHub('', (async () => new Response('{}', { status })) as typeof fetch); await assert.rejects(c.runs(repo), message); }
  await assert.rejects(new GitHub('', (async () => { throw new Error('secret network error'); }) as typeof fetch).runs(repo), /network request failed/);
}));
test('push uses reviewed SHA, handles missing upstream, stale remote, divergence and actual transport failure', async () => fixture(async repo => {
  raw(repo.path, 'remote', 'add', 'origin', 'https://github.com/test/repo.git');
  const base = raw(repo.path, 'rev-parse', 'HEAD');
  await writeFile(join(repo.path, 'file.txt'), 'outgoing'); raw(repo.path, 'commit', '-am', 'outgoing');
  let remoteHead = base, rejectPush = true; let pushes = 0;
  const transport: typeof git = async (_repo, args) => {
    if (args.includes('ls-remote')) return `${remoteHead}\trefs/heads/main\n`;
    if (args.includes('fetch')) return '';
    assert.ok(args.includes('push')); assert.ok(!args.includes('--force')); assert.ok(args.some(a => a.endsWith(':refs/heads/main'))); pushes++;
    if (rejectPush) throw new Error('protected branch rejected'); return 'done';
  };
  const review = await preparePush(repo, new GitHub(), undefined, transport); assert.equal(review.upstream, null); assert.equal(review.ahead, 1); assert.equal(review.behind, 0);
  await assert.rejects(push(repo, new GitHub(), review.snapshot, 'main', transport), /protected branch/); assert.equal(pushes, 1);
  rejectPush = false; const result = await push(repo, new GitHub(), review.snapshot, 'main', transport); assert.equal(result.sha, review.head);
  raw(repo.path, 'checkout', '-b', 'remote-only', base); await writeFile(join(repo.path, 'file.txt'), 'remote divergence'); raw(repo.path, 'commit', '-am', 'remote-only'); remoteHead = raw(repo.path, 'rev-parse', 'HEAD'); raw(repo.path, 'checkout', 'main');
  await assert.rejects(push(repo, new GitHub(), review.snapshot, 'main', transport), /changed/);
  const divergent = await preparePush(repo, new GitHub(), undefined, transport); assert.equal(divergent.behind, 1); await assert.rejects(push(repo, new GitHub(), divergent.snapshot, 'main', transport), /absent locally/);
}));
test('HTTP authorization, origin, CSRF, allowlist, approval, session review, MCP', async () => fixture(async repo => {
  const port = 45000 + Math.floor(Math.random() * 10000); const origin = 'http://localhost:3000';
  const server = createAgent({ repos: [repo], bootstrapCredential: 'a'.repeat(64), origin, port, github: new GitHub() });
  await new Promise<void>(resolve => server.listen(port, '127.0.0.1', resolve));
  const endpoint = `http://127.0.0.1:${port}`; let cookie = '', csrf = '';
  async function request(action: string, input: object = {}, headers: Record<string, string> = {}) { return fetch(`${endpoint}/studio/${action}`, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', Cookie: cookie, 'X-Studio-CSRF': csrf, ...headers }, body: JSON.stringify({ repo: repo.id, ...input }) }); }
  try {
    assert.equal((await request('status')).status, 401); assert.equal((await request('bootstrap', { credential: 'a'.repeat(64) }, { Origin: 'https://evil.example' })).status, 403);
    assert.equal((await request('bootstrap', { credential: 'wrong' })).status, 401);
    const login = await request('bootstrap', { credential: 'a'.repeat(64) }); cookie = login.headers.get('set-cookie')!.split(';')[0]; csrf = (await login.json()).csrf;
    assert.match(login.headers.get('set-cookie')!, /HttpOnly; SameSite=Strict/);
    assert.equal((await request('status', {}, { 'X-Studio-CSRF': '' })).status, 403); assert.equal((await request('status', { repo: '../outside' })).status, 403);
    assert.equal((await request('bootstrap', { credential: 'a'.repeat(64) })).status, 401);
    assert.equal((await request('session', {}, { 'X-Studio-CSRF': '' })).status, 200);
    assert.equal((await request('session', {}, { Origin: 'https://evil.example' })).status, 403);
    await writeFile(join(repo.path, 'file.txt'), 'changed\n');
    assert.equal((await request('stage', { paths: ['file.txt'] })).status, 403); assert.equal((await request('stage', { paths: ['file.txt'], approve: true })).status, 200);
    assert.equal((await request('commit', { approve: true, snapshot: 'invented', title: 'test' })).status, 409);
    assert.equal((await request('commit', { snapshot: 'invented', title: 'test' })).status, 403);
    assert.equal((await request('push', { snapshot: 'invented' })).status, 403);
    assert.equal((await request('push', { snapshot: 'invented', approve: true })).status, 409);
    server.connectGitHub('github_pat_test_fixture');
    const catalog = await (await request('repos')).json(); assert.equal(catalog.githubConnected, true); assert.ok(!JSON.stringify(catalog).includes('github_pat_test_fixture'));
    const review = await (await request('prepare-commit')).json();
    assert.equal((await request('commit', { approve: true, snapshot: review.snapshot, title: 'feat: HTTP review' })).status, 200);
    assert.equal((await request('commit', { approve: true, snapshot: review.snapshot, title: 'replay' })).status, 409);
    const mcp = await (await request('mcp', { jsonrpc: '2.0', id: 1, method: 'tools/list' })).json(); assert.equal(mcp.result.tools.length, toolNames.length);
    assert.equal((await request('logout')).status, 200); assert.equal((await request('status')).status, 401);
  } finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
}));
test('session expiry revokes HTTP writes and reconnect invalidates old cookies', async () => fixture(async repo => {
  let now = Date.now(); const port = 45000 + Math.floor(Math.random() * 10000); const origin = 'http://localhost:3000';
  const server = createAgent({ repos: [repo], bootstrapCredential: 'b'.repeat(64), origin, port, github: new GitHub(), now: () => now });
  await new Promise<void>(resolve => server.listen(port, '127.0.0.1', resolve));
  let cookie = '', csrf = '';
  const request = (action: string, input = {}) => fetch(`http://127.0.0.1:${port}/studio/${action}`, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', Cookie: cookie, 'X-Studio-CSRF': csrf }, body: JSON.stringify({ repo: repo.id, ...input }) });
  try {
    const response = await request('bootstrap', { credential: 'b'.repeat(64) }); cookie = response.headers.get('set-cookie')!.split(';')[0]; csrf = (await response.json()).csrf;
    server.connectGitHub('github_pat_expiry_fixture');
    now += 30 * 60_000;
    const expired = await request('stage', { paths: ['file.txt'], approve: true }); assert.equal(expired.status, 401); assert.equal((await expired.json()).code, 'SESSION_REQUIRED');
    assert.equal((await request('session')).status, 401);
    assert.throws(() => server.connectGitHub('github_pat_expiry_fixture'), /No active/);
    server.rotateBootstrap('c'.repeat(64));
    const next = await request('bootstrap', { credential: 'c'.repeat(64) }); const nextCookie = next.headers.get('set-cookie')!.split(';')[0]; const data = await next.json(); assert.equal(data.githubConnected, false);
    assert.equal((await request('status')).status, 401); cookie = nextCookie; csrf = data.csrf;
    assert.equal((await request('status')).status, 200);
    server.rotateBootstrap('d'.repeat(64)); assert.equal((await request('status')).status, 401);
    now += 2 * 60_000; assert.equal((await request('bootstrap', { credential: 'd'.repeat(64) })).status, 401);
  } finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
}));
test('real PowerShell launcher bootstraps, connects GitHub, reconnects and stops without logging credentials', { skip: process.platform !== 'win32' }, async () => fixture(async repo => {
  await mkdir(join(repo.path, 'scripts'));
  await cp(fileURLToPath(new URL('../../../scripts/start-developer-studio.ps1', import.meta.url)), join(repo.path, 'scripts/start-developer-studio.ps1'));
  await cp(fileURLToPath(new URL('../src', import.meta.url)), join(repo.path, 'services/developer-agent/src'), { recursive: true });
  await mkdir(join(repo.path, 'frontend/node_modules/next'), { recursive: true }); await writeFile(join(repo.path, 'frontend/node_modules/next/package.json'), '{}');
  const output = execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-File', fileURLToPath(new URL('./launcher-smoke.ps1', import.meta.url)), '-LauncherPath', join(repo.path, 'scripts/start-developer-studio.ps1'), '-Port', String(45000 + Math.floor(Math.random() * 10000))], { encoding: 'utf8', timeout: 60000, windowsHide: true });
  assert.match(output, /LAUNCHER_SMOKE_OK/); assert.doesNotMatch(output, /github_pat_launcher_test_fixture|#bootstrap=|read passphrase|write passphrase/);
}));
test('launcher control startup reports occupied ports without echoing private input', async () => fixture(async repo => {
  const port = 45000 + Math.floor(Math.random() * 10000);
  const server = createAgent({ repos: [repo], bootstrapCredential: 'f'.repeat(64), origin: 'http://localhost:3000', port, github: new GitHub() });
  await new Promise<void>(resolve => server.listen(port, '127.0.0.1', resolve));
  try {
    assert.throws(() => execFileSync(process.execPath, [fileURLToPath(new URL('../src/server.ts', import.meta.url))], { input: JSON.stringify({ repositories: [{ id: repo.id, name: repo.name, path: repo.path }], port, credential: 'e'.repeat(64), githubToken: 'github_pat_port_fixture' }) + '\n', encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], timeout: 30000, windowsHide: true }), (error: any) => {
      assert.match(error.stdout, /Agent port is already occupied/); assert.doesNotMatch(error.stdout + error.stderr, /github_pat_port_fixture|e{64}/); return true;
    });
  } finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
}));
