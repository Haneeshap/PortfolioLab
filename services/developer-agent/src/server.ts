import { createServer, type IncomingMessage } from 'node:http';
import { createInterface } from 'node:readline';
import { pathToFileURL } from 'node:url';
import { loadRepositories, overview, diff, stage, prepareCommit, commit, type Repo } from './git.ts';
import { GitHub, preparePush, push } from './github.ts';
import { analyze, readTool, toolNames } from './analysis.ts';
import { StudioError, requireValue, equalSecret } from './security.ts';
import { LocalSessions } from './sessions.ts';

export type AgentConfig = { repos: Repo[]; bootstrapCredential: string; origin: string; port: number; github: GitHub; model?: string; mcpSecret?: string; now?: () => number };
async function json(req: IncomingMessage): Promise<Record<string, any>> {
  requireValue(req.headers['content-type']?.split(';')[0] === 'application/json', 'JSON content type required.', 415);
  const chunks: Buffer[] = []; let size = 0;
  for await (const chunk of req) { size += chunk.length; requireValue(size <= 32768, 'Request exceeds 32 KiB.', 413); chunks.push(Buffer.from(chunk)); }
  try { const data = JSON.parse(Buffer.concat(chunks).toString()); requireValue(data && typeof data === 'object' && !Array.isArray(data), 'JSON object required.'); return data; }
  catch (e) { if (e instanceof StudioError) throw e; throw new StudioError('Invalid JSON.'); }
}
export function createAgent(config: AgentConfig) {
  requireValue(/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(config.origin), 'Only an explicitly configured local HTTP frontend origin is supported.');
  const sessions = new LocalSessions(config.bootstrapCredential, config.github, config.now);
  config.bootstrapCredential = '';
  const mcpGitHub = new GitHub('', config.github.fetcher);
  const expiryTimer = setInterval(() => sessions.get(), 1000);
  expiryTimer.unref();
  const queues = new Map<string, Promise<unknown>>();
  async function exclusive<T>(repo: Repo, fn: () => Promise<T>): Promise<T> {
    const previous = queues.get(repo.id) ?? Promise.resolve();
    const task = previous.catch(() => {}).then(fn); queues.set(repo.id, task);
    try { return await task; } finally { if (queues.get(repo.id) === task) queues.delete(repo.id); }
  }
  const server = createServer({ requestTimeout: 20000, headersTimeout: 10000, maxHeaderSize: 8192 }, async (req, res) => {
    const send = (status: number, data: unknown) => { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'" }); res.end(JSON.stringify(data)); };
    try {
      requireValue([`localhost:${config.port}`, `127.0.0.1:${config.port}`].includes(req.headers.host ?? ''), 'Host rejected.', 403);
      const bearerMcp = req.url === '/studio/mcp' && !!config.mcpSecret && equalSecret(String(req.headers.authorization ?? ''), 'Bearer ' + config.mcpSecret);
      requireValue(bearerMcp ? !req.headers.origin : req.headers.origin === config.origin, 'Origin rejected. Use the configured local PortfolioLab frontend.', 403);
      if (!bearerMcp) { res.setHeader('Access-Control-Allow-Origin', config.origin); res.setHeader('Access-Control-Allow-Credentials', 'true'); res.setHeader('Vary', 'Origin'); }
      if (req.method === 'OPTIONS') { res.setHeader('Access-Control-Allow-Methods', 'POST'); res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Studio-CSRF'); res.writeHead(204); res.end(); return; }
      requireValue(req.method === 'POST', 'Only POST is supported.', 405);
      const input = await json(req);
      const now = sessions.now();
      if (req.url === '/studio/bootstrap') {
        const { id, session } = sessions.exchange(input.credential);
        res.setHeader('Set-Cookie', `studio_session=${id}; HttpOnly; SameSite=Strict; Path=/studio; Max-Age=1800`);
        send(200, { csrf: session.csrf, expiresAt: new Date(session.expires).toISOString(), githubConnected: !!session.github.token }); return;
      }
      const id = /(?:^|;\s*)studio_session=([a-f0-9]{64})(?:;|$)/.exec(req.headers.cookie ?? '')?.[1];
      const session = id ? sessions.get(id) : undefined;
      if (!bearerMcp && !session) throw new StudioError('Local developer session expired or disconnected. Press R in the launcher to reconnect.', 401, 'SESSION_REQUIRED');
      // Session recovery is read-only and still requires exact Origin + HttpOnly cookie.
      if (req.url === '/studio/session') { send(200, { csrf: session!.csrf, expiresAt: new Date(session!.expires).toISOString(), githubConnected: !!session!.github.token }); return; }
      if (!bearerMcp) requireValue(equalSecret(String(req.headers['x-studio-csrf'] ?? ''), session!.csrf), 'Session CSRF token required.', 403);
      if (req.url === '/studio/logout') { sessions.remove(id!); res.setHeader('Set-Cookie', 'studio_session=; HttpOnly; SameSite=Strict; Path=/studio; Max-Age=0'); send(200, { signedOut: true }); return; }
      const github = session?.github ?? mcpGitHub;
      if (req.url === '/studio/repos') { send(200, { repositories: config.repos.map(r => ({ id: r.id, name: r.name })), githubConnected: !!github.token, githubCredential: github.token ? 'Connected (session memory only)' : 'Not connected (local Git works without it)', ai: config.model ?? 'Disabled' }); return; }
      let args = input;
      if (req.url === '/studio/mcp') {
        requireValue(input.jsonrpc === '2.0', 'JSON-RPC 2.0 required.');
        if (input.method === 'initialize') { send(200, { jsonrpc: '2.0', id: input.id, result: { protocolVersion: '2025-03-26', capabilities: { tools: {} }, serverInfo: { name: 'portfoliolab-developer-studio', version: '1.0.0' } } }); return; }
        if (input.method === 'notifications/initialized' || input.method === 'notifications/cancelled') { res.writeHead(202); res.end(); return; }
        if (input.method === 'ping') { send(200, { jsonrpc: '2.0', id: input.id, result: {} }); return; }
        if (input.method === 'tools/list') { send(200, { jsonrpc: '2.0', id: input.id, result: { tools: toolNames.map(name => ({ name, description: 'Read-only PortfolioLab developer evidence. Never authorizes Git writes.', inputSchema: { type: 'object', properties: { repo: { type: 'string', enum: config.repos.map(r => r.id) }, path: { type: 'string' }, layer: { type: 'string', enum: ['staged', 'unstaged'] }, sha: { type: 'string' }, runId: { type: 'integer' }, destination: { type: 'string' } }, required: ['repo'], additionalProperties: false }, annotations: { readOnlyHint: true, destructiveHint: false } })) } }); return; }
        requireValue(input.method === 'tools/call', 'Unsupported MCP method.'); args = input.params?.arguments ?? {};
      }
      const repo = config.repos.find(r => r.id === args.repo); requireValue(repo, 'Repository is not allowlisted.', 403);
      if (req.url === '/studio/mcp') {
        try { const evidence = await exclusive(repo, () => readTool(repo, github, input.params?.name, args)); send(200, { jsonrpc: '2.0', id: input.id, result: { content: [{ type: 'text', text: JSON.stringify(evidence) }] } }); }
        catch (e) { send(200, { jsonrpc: '2.0', id: input.id, result: { isError: true, content: [{ type: 'text', text: e instanceof StudioError ? e.message : 'Tool failed.' }] } }); }
        return;
      }
      const action = req.url?.replace('/studio/', '');
      if (['stage', 'unstage', 'commit', 'push'].includes(action ?? '')) {
        requireValue(input.approve === true, 'Explicit developer approval is required.', 403);
      }
      const result = await exclusive(repo, async () => {
        if (!bearerMcp && sessions.get(id!) !== session) throw new StudioError('Developer session expired while waiting. Reconnect through the launcher.', 401, 'SESSION_REQUIRED');
        switch (action) {
          case 'status': return overview(repo);
          case 'diff': return diff(repo, input.path, input.layer, input.expanded === true ? 2 * 1024 * 1024 : undefined);
          case 'stage': case 'unstage': session!.reviews.clear(); return stage(repo, input.paths, action === 'unstage');
          case 'prepare-commit': {
            const review = await prepareCommit(repo); session!.reviews.set(review.snapshot, { repo: repo.id, kind: 'commit', expires: now + 10 * 60000 }); return review;
          }
          case 'prepare-push': {
            const review = await preparePush(repo, github, input.destination); session!.reviews.set(review.snapshot, { repo: repo.id, kind: 'push', expires: now + 10 * 60000, destination: review.destination }); return review;
          }
          case 'commit': case 'push': {
            const approval = session!.reviews.get(input.snapshot);
            requireValue(approval && approval.repo === repo.id && approval.kind === action && approval.expires > sessions.now(), 'Prepare a fresh review in this session before approving.', 409);
            session!.reviews.delete(input.snapshot);
            return action === 'commit' ? commit(repo, input.snapshot, input.title, input.body) : push(repo, github, input.snapshot, approval.destination!);
          }
          case 'ci': return github.runs(repo, input.sha);
          case 'ci-details': return github.details(repo, input.runId);
          case 'analyze': {
            const controller = new AbortController(); res.on('close', () => controller.abort());
            if (res.destroyed) controller.abort();
            return analyze(repo, github, input, controller.signal, config.model);
          }
          default: throw new StudioError('Unknown developer endpoint.', 404);
        }
      });
      send(200, result);
    } catch (e) { if (!res.headersSent) send(e instanceof StudioError ? e.status : 500, { error: e instanceof StudioError ? e.message : 'Developer operation failed. Check repository configuration and availability.', ...(e instanceof StudioError && e.code ? { code: e.code } : {}) }); }
  });
  server.on('close', () => { clearInterval(expiryTimer); sessions.clear(); });
  return Object.assign(server, {
    rotateBootstrap: (credential: string) => sessions.rotate(credential),
    connectGitHub: (token: string) => sessions.connectGitHub(token)
  });
}
export async function start() {
  requireValue(!process.stdin.isTTY, 'Start Developer Studio with scripts/start-developer-studio.ps1.');
  // Secrets arrive only on the launcher's private stdin pipe, never argv or files.
  for (const key of ['STUDIO_GITHUB_TOKEN', 'STUDIO_READ_SECRET', 'STUDIO_WRITE_SECRET', 'STUDIO_BOOTSTRAP_SECRET']) delete process.env[key];
  const mcpSecret = process.env.STUDIO_MCP_SECRET;
  delete process.env.STUDIO_MCP_SECRET;
  const lines = createInterface({ input: process.stdin, crlfDelay: Infinity });
  let server: ReturnType<typeof createAgent> | undefined;
  try {
    for await (const line of lines) {
      try {
        requireValue(Buffer.byteLength(line) <= 65536, 'Launcher control message too large.');
        const input = JSON.parse(line);
        if (!server) {
          const port = Number(input.port ?? 4317);
          requireValue(Number.isInteger(port) && port > 1024 && port <= 65535, 'Invalid agent port.');
          const token = input.githubToken ?? '';
          requireValue(typeof token === 'string' && (!token || /^github_pat_[A-Za-z0-9_]+$/.test(token)), 'Use a fine-grained GitHub PAT.');
          const repos = await loadRepositories(input.repositories ?? []);
          requireValue(!mcpSecret || mcpSecret.length >= 32, 'MCP read credential must have at least 32 characters.');
          server = createAgent({ repos, port, origin: input.origin ?? 'http://localhost:3000', bootstrapCredential: input.credential, github: new GitHub(token), model: input.model || undefined, mcpSecret });
          await new Promise<void>((resolve, reject) => { server!.once('error', reject); server!.listen(port, '127.0.0.1', resolve); });
          process.stdout.write('STUDIO_READY\n');
        } else if (input.command === 'bootstrap') {
          server.rotateBootstrap(input.credential);
          process.stdout.write('STUDIO_BOOTSTRAP_READY\n');
        } else if (input.command === 'github') {
          server.connectGitHub(input.token);
          process.stdout.write('STUDIO_GITHUB_CONNECTED\n');
        } else throw new StudioError('Unknown launcher command.');
      } catch (error) {
        const code = (error as NodeJS.ErrnoException).code;
        const message = code === 'EADDRINUSE' ? 'Agent port is already occupied. Stop the previous launcher or choose -Port.' : code === 'EACCES' ? 'Agent cannot bind to that port. Choose an available unprivileged port.' : error instanceof StudioError ? error.message : 'Agent configuration failed. Check Node, Git and repository paths.';
        process.stdout.write('STUDIO_ERROR ' + JSON.stringify(message) + '\n');
        if (!server?.listening) { process.exitCode = 1; break; }
      }
    }
  } finally { lines.close(); if (server) { server.closeAllConnections(); server.close(); } }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) start().catch(() => { process.stderr.write('Agent startup failed. Use scripts/start-developer-studio.ps1 and check local prerequisites.\n'); process.exitCode = 1; });
