import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { git, overview, validateRepo, type Repo } from './git.ts';
import { requireValue, StudioError, redact } from './security.ts';

export function githubRepo(url: string) {
  const match = /^https:\/\/github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?$/.exec(url);
  requireValue(match && !['.', '..'].includes(match[1]) && !['.', '..'].includes(match[2]), 'Configure origin as a credential-free https://github.com/OWNER/REPO.git URL.');
  return { owner: match[1], name: match[2], url: `https://github.com/${match[1]}/${match[2]}.git` };
}
export async function boundedText(response: Response, max = 1024 * 1024) {
  const reader = response.body?.getReader(); requireValue(reader, 'Empty remote response.', 502);
  const chunks: Uint8Array[] = []; let size = 0;
  try { while (true) { const part = await reader.read(); if (part.done) break; size += part.value.length; requireValue(size <= max, 'Remote response exceeds bounded limit.', 502); chunks.push(part.value); } }
  finally { await reader.cancel(); }
  return Buffer.concat(chunks).toString('utf8');
}
export class GitHub {
  token: string; fetcher: typeof fetch;
  constructor(token = '', fetcher: typeof fetch = fetch) { this.token = token; this.fetcher = fetcher; }
  async api(path: string): Promise<Record<string, any>> {
    let response: Response;
    try { response = await this.fetcher('https://api.github.com' + path, { headers: { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2026-03-10', ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}) }, redirect: 'error', signal: AbortSignal.timeout(15000) }); }
    catch { throw new StudioError('GitHub network request failed or timed out. Retry manually.', 502); }
    if (response.status === 401) throw new StudioError('GitHub credential is invalid or expired. Enter G in the launcher to replace it for this local session.', 401);
    if (response.status === 403 || response.status === 429) throw new StudioError(response.headers.get('x-ratelimit-remaining') === '0' || response.status === 429 ? `GitHub rate limit reached; retry after ${response.headers.get('x-ratelimit-reset') ?? 'the indicated reset'}.` : 'GitHub denied access. Check fine-grained repository and Actions read permissions.', 403);
    requireValue(response.ok, response.status === 404 ? 'GitHub resource unavailable. Check repository access and Actions configuration.' : `GitHub returned HTTP ${response.status}.`, 502);
    try { return JSON.parse(await boundedText(response)); } catch (e) { if (e instanceof StudioError) throw e; throw new StudioError('Invalid GitHub response.', 502); }
  }
  async identity(repo: Repo) { await validateRepo(repo); return githubRepo((await git(repo, ['config', '--get', 'remote.origin.url'])).trim()); }
  async runs(repo: Repo, sha?: string) {
    const { owner, name } = await this.identity(repo);
    requireValue(!sha || /^[a-f0-9]{40,64}$/.test(sha), 'Invalid commit SHA.');
    const state = await overview(repo);
    const query = sha ? `head_sha=${sha}` : state.branch ? `branch=${encodeURIComponent(state.branch)}` : '';
    const data = await this.api(`/repos/${owner}/${name}/actions/runs?per_page=15&${query}`);
    return { fetchedAt: new Date().toISOString(), sha: sha ?? null, runs: (data.workflow_runs ?? []).map((r: any) => ({ id: r.id, name: redact(r.name ?? 'Workflow'), branch: r.head_branch, sha: r.head_sha, event: r.event, status: r.status ?? 'unknown', conclusion: r.conclusion, startedAt: r.run_started_at, updatedAt: r.updated_at, url: safeGitHubLink(r.html_url) })) };
  }
  async details(repo: Repo, runId: number) {
    requireValue(Number.isSafeInteger(runId) && runId > 0, 'Invalid run ID.');
    const { owner, name } = await this.identity(repo);
    const data = await this.api(`/repos/${owner}/${name}/actions/runs/${runId}/jobs?per_page=30`);
    const jobs = (data.jobs ?? []).map((j: any) => ({ id: j.id, name: redact(j.name), status: j.status, conclusion: j.conclusion, startedAt: j.started_at, completedAt: j.completed_at, url: safeGitHubLink(j.html_url), steps: (j.steps ?? []).map((s: any) => ({ number: s.number, name: redact(s.name), status: s.status, conclusion: s.conclusion, startedAt: s.started_at, completedAt: s.completed_at })) }));
    return { fetchedAt: new Date().toISOString(), jobs, limited: data.total_count > jobs.length, failures: jobs.flatMap((j: any) => j.steps.filter((s: any) => ['failure', 'timed_out'].includes(s.conclusion)).map((s: any) => ({ job: j.name, step: s.name, conclusion: s.conclusion, url: j.url }))), evidence: 'GitHub job and step metadata. Full logs are available at the source links; root cause is not inferred.' };
  }
}
function safeGitHubLink(url: string) { return typeof url === 'string' && url.startsWith('https://github.com/') ? url : 'https://github.com'; }
async function networkConfig(repo: Repo) {
  // Includes are resolved by Git. Reject effective URL rewrites and transport overrides.
  const config = await git(repo, ['config', '--get-regexp', '^(url\\..*\\.(insteadof|pushinsteadof)|http\\..*|credential\\..*|core\\.sshcommand|remote\\..*\\.(proxy|receivepack|uploadpack))$'], { diffExit: true, env: { GIT_CONFIG_GLOBAL: process.platform === 'win32' ? 'NUL' : '/dev/null' } });
  requireValue(!config.trim(), 'Repository transport overrides are not supported. Review Git configuration before network operations.', 409);
}
const networkEnv = () => ({ GIT_CONFIG_GLOBAL: process.platform === 'win32' ? 'NUL' : '/dev/null', GIT_ASKPASS: fileURLToPath(new URL('./askpass.sh', import.meta.url)), STUDIO_NODE: process.execPath, STUDIO_ASKPASS_SCRIPT: fileURLToPath(new URL('./askpass.cjs', import.meta.url)) });
const networkArgs = ['-c', 'credential.helper=', '-c', 'http.followRedirects=false', '-c', 'http.sslVerify=true', '-c', 'protocol.allow=never', '-c', 'protocol.https.allow=always'];
export async function preparePush(repo: Repo, github: GitHub, targetBranch?: string, transport: typeof git = git) {
  const state = await overview(repo); requireValue(state.branch && state.head, 'Push requires an attached branch with a commit.', 409);
  const destination = targetBranch || (state.upstream?.startsWith('origin/') ? state.upstream.slice(7) : state.branch);
  requireValue(typeof destination === 'string' && !destination.startsWith('-'), 'Invalid destination branch.');
  await git(repo, ['check-ref-format', 'refs/heads/' + destination]);
  await networkConfig(repo);
  const identity = await github.identity(repo);
  const env = { ...networkEnv(), STUDIO_GITHUB_TOKEN: github.token };
  const remoteRef = `refs/heads/${destination}`;
  const result = await transport(repo, [...networkArgs, 'ls-remote', '--refs', identity.url, remoteRef], { env });
  const remoteHead = result.trim().split(/\s+/)[0] || null;
  let ahead = 0, behind = 0, commits: { sha: string; title: string }[] = [];
  if (remoteHead) {
    // Fetch objects into FETCH_HEAD, without changing local branches or the index.
    await transport(repo, [...networkArgs, 'fetch', '--no-tags', '--no-recurse-submodules', identity.url, remoteRef], { env });
    const counts = (await git(repo, ['rev-list', '--left-right', '--count', `${state.head}...${remoteHead}`])).trim().split(/\s+/).map(Number);
    [ahead, behind] = counts;
  } else ahead = Number((await git(repo, ['rev-list', '--count', state.head])).trim());
  const raw = await git(repo, ['log', '-30', '--format=%H%x00%s', remoteHead ? `${remoteHead}..${state.head}` : state.head]);
  commits = raw.trim().split('\n').filter(Boolean).map(row => { const [sha, title] = row.split('\0'); return { sha, title: redact(title) }; });
  const data = { head: state.head, branch: state.branch, remote: identity.url, destination, remoteHead, ahead, behind, upstream: state.upstream };
  return { ...data, snapshot: createHash('sha256').update(JSON.stringify(data)).digest('hex'), commits, commitsLimited: ahead > 30, protection: 'Unknown — GitHub enforces branch protection on push.', fetchedAt: new Date().toISOString() };
}
export async function push(repo: Repo, github: GitHub, approved: string, destination: string, transport: typeof git = git) {
  const review = await preparePush(repo, github, destination, transport);
  requireValue(review.snapshot === approved, 'Local or remote branch changed. Prepare and approve a new push review.', 409);
  requireValue(review.behind === 0 && review.ahead > 0, review.behind ? 'Remote has commits absent locally. Reconcile in your Git client, then review again.' : 'No outgoing commits.', 409);
  await transport(repo, [...networkArgs, 'push', '--porcelain', '--no-verify', '--recurse-submodules=no', review.remote, `${review.head}:refs/heads/${review.destination}`], { env: { ...networkEnv(), STUDIO_GITHUB_TOKEN: github.token } });
  return { sha: review.head, remote: review.remote, branch: review.destination, message: 'Git confirmed the push. CI status must be fetched separately.' };
}
