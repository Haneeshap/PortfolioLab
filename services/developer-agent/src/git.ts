import { execFile } from 'node:child_process';
import { realpath, lstat, open, copyFile, unlink } from 'node:fs/promises';
import { resolve, relative, dirname, isAbsolute, join } from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { StudioError, requireValue, flags, group, redact } from './security.ts';

export type RepoConfig = { id: string; name: string; path: string };
export type ChangedFile = { path: string; oldPath?: string; index: string; worktree: string; staged: boolean; unstaged: boolean; untracked: boolean; conflict: boolean; group: string; flags: string[] };
export type Repo = RepoConfig & { gitDir: string };
const baseArgs = ['-c', 'core.fsmonitor=false', '-c', 'core.hooksPath=/dev/null', '-c', 'diff.external=', '-c', 'core.quotePath=false', '-c', 'commit.gpgSign=false', '-c', 'maintenance.auto=false', '-c', 'gc.auto=0'];
// Never inherit caller-controlled Git execution/configuration overrides.
export function gitEnvironment(extra: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  const env = { ...process.env };
  for (const key of Object.keys(env)) if (/^GIT_|^SSH_ASKPASS|^STUDIO_/.test(key)) delete env[key];
  return { ...env, GIT_TERMINAL_PROMPT: '0', GIT_CONFIG_NOSYSTEM: '1', GIT_LITERAL_PATHSPECS: '1', ...extra };
}
export async function git(repo: Pick<Repo, 'path'>, args: string[], options: { env?: NodeJS.ProcessEnv; input?: string; max?: number; diffExit?: boolean } = {}): Promise<string> {
  return new Promise((done, fail) => {
    const child = execFile('git', [...baseArgs, ...args], { cwd: repo.path, env: gitEnvironment(options.env), encoding: 'utf8', timeout: 60000, maxBuffer: options.max ?? 4 * 1024 * 1024, windowsHide: true }, (error, stdout, stderr) => {
      if (error && !(options.diffExit && error.code === 1)) fail(new StudioError(error.code === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER' ? 'Git output exceeds the bounded limit. Narrow your selection.' : redact(stderr.trim()).slice(0, 3000) || 'Git failed or timed out. Check repository availability and lock files.', 409));
      else done(stdout);
    });
    child.stdin?.end(options.input);
  });
}
async function optional(repo: Repo, args: string[]) { try { return (await git(repo, args)).trim(); } catch { return null; } }
function within(root: string, target: string) { const r = relative(root, target); return r === '' || (!isAbsolute(r) && r !== '..' && !r.startsWith('..\\') && !r.startsWith('../')); }
export async function loadRepositories(configs: RepoConfig[]): Promise<Repo[]> {
  requireValue(configs.length > 0 && configs.length <= 10, 'Configure 1–10 repositories.');
  requireValue(new Set(configs.map(c => c.id)).size === configs.length, 'Repository IDs must be unique.');
  return Promise.all(configs.map(async config => {
    requireValue(/^[a-z0-9-]{1,40}$/.test(config.id) && typeof config.name === 'string' && isAbsolute(config.path), 'Invalid repository configuration.');
    const path = await realpath(config.path);
    const top = await realpath((await git({ path }, ['rev-parse', '--show-toplevel'])).trim());
    requireValue(top === path, 'Allowlist must identify repository roots.');
    const gitDir = await realpath((await git({ path }, ['rev-parse', '--absolute-git-dir'])).trim());
    // Linked worktrees / external Git directories require a separate trust model.
    requireValue(within(path, gitDir), 'External Git directories and linked worktrees are not supported.');
    return { ...config, path, gitDir };
  }));
}
export async function validateRepo(repo: Repo) {
  requireValue(await realpath(repo.path) === repo.path && await realpath(join(repo.path, '.git')) === repo.gitDir, 'Repository identity changed; restart the agent.', 409);
}
export async function safePath(repo: Repo, path: string) {
  requireValue(typeof path === 'string' && path.length > 0 && path.length < 4096 && !path.includes('\\') && !path.includes('\0') && !path.includes(':') && !isAbsolute(path) && !path.split('/').some(p => !p || p === '..' || p === '.' || p.replace(/[ .]+$/, '').toLowerCase() === '.git'), 'Invalid repository path.');
  const target = resolve(repo.path, path);
  requireValue(within(repo.path, target), 'Path escapes repository.');
  let cursor = repo.path;
  for (const part of path.split('/')) {
    cursor = join(cursor, part);
    try { requireValue(!(await lstat(cursor)).isSymbolicLink(), 'Symlinks and junctions are excluded from file operations.'); }
    catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e; }
  }
  return target;
}
export function parseStatus(raw: string): ChangedFile[] {
  const parts = raw.split('\0'); const files: ChangedFile[] = [];
  for (let n = 0; n < parts.length; n++) {
    const row = parts[n]; if (!row) continue;
    const index = row[0], worktree = row[1], path = row.slice(3);
    const oldPath = /[RC]/.test(index + worktree) ? parts[++n] : undefined;
    const untracked = index === '?';
    const conflict = ['DD', 'AU', 'UD', 'UA', 'DU', 'AA', 'UU'].includes(index + worktree);
    files.push({ path, oldPath, index, worktree, staged: !untracked && index !== ' ', unstaged: !untracked && worktree !== ' ', untracked, conflict, group: group(path), flags: flags(path, conflict) });
  }
  return files;
}
export async function changed(repo: Repo) { await validateRepo(repo); return parseStatus(await git(repo, ['status', '--porcelain=v1', '-z', '--untracked-files=all'])); }
export async function overview(repo: Repo) {
  const files = await changed(repo);
  const branch = await optional(repo, ['symbolic-ref', '--quiet', '--short', 'HEAD']);
  const head = await optional(repo, ['rev-parse', '--verify', 'HEAD']);
  const upstream = await optional(repo, ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}']);
  const counts = upstream ? await optional(repo, ['rev-list', '--left-right', '--count', 'HEAD...@{upstream}']) : null;
  const [ahead, behind] = counts?.split(/\s+/).map(Number) ?? [null, null];
  const remote = await optional(repo, ['config', '--get', 'remote.origin.url']);
  const stats = head ? await optional(repo, ['diff', '--numstat', '--no-renames', 'HEAD', '--']) : null;
  let added = 0, removed = 0;
  for (const row of stats?.split('\n') ?? []) { const [a, d] = row.split('\t'); if (/^\d+$/.test(a)) added += +a; if (/^\d+$/.test(d)) removed += +d; }
  return { id: repo.id, name: repo.name, branch, head, upstream, ahead, behind, remote: remote ? redact(remote) : null, files, clean: !files.length,
    counts: { staged: files.filter(f => f.staged).length, unstaged: files.filter(f => f.unstaged).length, untracked: files.filter(f => f.untracked).length, total: files.length },
    lines: { added, removed, scope: 'Tracked net changes against HEAD; binary and untracked files excluded' }, refreshedAt: new Date().toISOString(), trackingFreshness: 'Local tracking refs only; push review contacts GitHub', recent: head ? await recent(repo) : [] };
}
export async function recent(repo: Repo) { return (await git(repo, ['log', '-8', '--format=%H%x00%s'])).trim().split('\n').filter(Boolean).map(row => { const [sha, title] = row.split('\0'); return { sha, title: redact(title) }; }); }
export async function diff(repo: Repo, path: string, layer: string, limit = 128 * 1024) {
  requireValue(['staged', 'unstaged'].includes(layer), 'Choose staged or unstaged diff.');
  const file = (await changed(repo)).find(f => f.path === path); requireValue(file, 'File is no longer changed.', 409);
  const target = await safePath(repo, path);
  let text: string;
  if (file.untracked) {
    const stat = await lstat(target); requireValue(stat.isFile(), 'Only regular untracked files can be previewed.');
    if (stat.size > 2 * 1024 * 1024) return { text: '', truncated: true, binary: false, large: true, flags: [...file.flags, 'Large file: preview unavailable above 2 MiB'] };
    const handle = await open(target, 'r');
    let bytes: Buffer;
    try { const sample = Buffer.alloc(2 * 1024 * 1024 + 1); const result = await handle.read(sample, 0, sample.length, 0); requireValue(result.bytesRead <= 2 * 1024 * 1024, 'File grew above the preview limit. Refresh and review with your Git client.', 409); bytes = sample.subarray(0, result.bytesRead); }
    finally { await handle.close(); }
    if (bytes.includes(0)) return { text: '', binary: true, truncated: false, flags: file.flags };
    text = await git(repo, ['diff', '--no-index', '--no-ext-diff', '--no-textconv', '--no-color', '--', '/dev/null', path], { diffExit: true });
  } else text = await git(repo, ['diff', '--no-ext-diff', '--no-textconv', '--no-color', '--no-renames', ...(layer === 'staged' ? ['--cached'] : []), '--', path, ...(file.oldPath ? [file.oldPath] : [])]);
  const warning = redact(text) !== text ? ['Potential credential detected — review before staging.'] : [];
  return { text: text.slice(0, limit), truncated: text.length > limit, binary: /Binary files .* differ|GIT binary patch/.test(text), flags: [...file.flags, ...warning], large: text.length > 128 * 1024 };
}
export async function stage(repo: Repo, paths: string[], unstage = false) {
  requireValue(Array.isArray(paths) && paths.length > 0 && paths.length <= 500 && paths.every(p => typeof p === 'string'), 'Select 1–500 files.');
  const files = await changed(repo); const allowed = new Set(files.map(f => f.path));
  const selected: string[] = [];
  for (const path of paths) { requireValue(allowed.has(path), 'Only current changed files may be staged.'); await safePath(repo, path); selected.push(path); const old = files.find(f => f.path === path)?.oldPath; if (old) { await safePath(repo, old); selected.push(old); } }
  const filters = await optional(repo, ['config', '--get-regexp', '^filter\\..*\\.(clean|smudge|process)$']);
  requireValue(!filters, 'Configured executable Git filters are not supported by Studio. Stage through your Git client.', 409);
  const head = await optional(repo, ['rev-parse', '--verify', 'HEAD']);
  if (unstage) await git(repo, head ? ['restore', '--staged', '--', ...selected] : ['rm', '--cached', '--force', '--ignore-unmatch', '--', ...selected]);
  else await git(repo, ['add', '--', ...selected]);
  return overview(repo);
}
export type CommitReview = { snapshot: string; tree: string; head: string | null; ref: string; paths: string[]; diff: string; suggestion: string; flags: string[] };
function snapshot(tree: string, head: string | null, ref: string) { return createHash('sha256').update(JSON.stringify({ tree, head, ref })).digest('hex'); }
export async function prepareCommit(repo: Repo): Promise<CommitReview> {
  const state = await overview(repo);
  requireValue(state.branch, 'Detached HEAD: switch to a branch before committing.', 409);
  requireValue(!state.files.some(f => f.conflict), 'Resolve merge conflicts before committing.', 409);
  requireValue(!await optional(repo, ['rev-parse', '--verify', 'MERGE_HEAD']), 'Complete the merge using your Git client first.', 409);
  const tree = (await git(repo, ['write-tree'])).trim();
  const base = state.head ? (await git(repo, ['rev-parse', 'HEAD^{tree}'])).trim() : null;
  requireValue(tree !== base && state.counts.staged > 0, 'No staged changes to commit.', 409);
  const text = await git(repo, ['diff', '--cached', '--no-ext-diff', '--no-textconv', '--no-color', '--no-renames', '--']);
  const paths = (await git(repo, ['diff', '--cached', '--name-only', '-z', '--no-renames', '--'])).split('\0').filter(Boolean);
  requireValue(text.length <= 2 * 1024 * 1024, 'Staged diff exceeds 2 MiB. Review a smaller commit.', 409);
  const ref = 'refs/heads/' + state.branch;
  requireValue((await git(repo, ['write-tree'])).trim() === tree && await optional(repo, ['rev-parse', '--verify', 'HEAD']) === state.head && await optional(repo, ['symbolic-ref', '--quiet', 'HEAD']) === ref, 'Repository changed during review preparation. Refresh and try again.', 409);
  return { snapshot: snapshot(tree, state.head, ref), tree, head: state.head, ref, paths, diff: text,
    suggestion: `chore: update ${[...new Set(state.files.filter(f => f.staged).map(f => f.group.toLowerCase()))].slice(0, 3).join(', ')}`,
    flags: [...new Set(paths.flatMap(path => flags(path)).concat(redact(text) !== text ? ['Potential credential detected — review before committing.'] : []))] };
}
export async function commit(repo: Repo, approved: string, title: string, body = '') {
  requireValue(typeof title === 'string' && title.trim().length > 0 && title.length <= 120 && !/[\r\n\0]/.test(title), 'Commit title must be 1–120 characters on one line.');
  requireValue(typeof body === 'string' && body.length <= 10000 && !body.includes('\0'), 'Invalid commit body.');
  await validateRepo(repo);
  const lockPath = join(repo.gitDir, 'index.lock');
  let lock;
  try { lock = await open(lockPath, 'wx'); } catch { throw new StudioError('Git index is locked by another operation. Retry after it finishes.', 409); }
  const temporary = join(repo.gitDir, 'studio-index-' + randomUUID());
  try {
    await copyFile(join(repo.gitDir, 'index'), temporary);
    const tree = (await git(repo, ['write-tree'], { env: { GIT_INDEX_FILE: temporary } })).trim();
    const head = await optional(repo, ['rev-parse', '--verify', 'HEAD']);
    const ref = await optional(repo, ['symbolic-ref', '--quiet', 'HEAD']);
    requireValue(ref && snapshot(tree, head, ref) === approved, 'Staged content or branch changed. Prepare and approve a fresh review.', 409);
    requireValue(!await optional(repo, ['rev-parse', '--verify', 'MERGE_HEAD']), 'Merge in progress; use your Git client.', 409);
    const sha = (await git(repo, ['commit-tree', tree, ...(head ? ['-p', head] : [])], { input: title.trim() + (body ? '\n\n' + body : '') + '\n' })).trim();
    await git(repo, ['update-ref', '-m', 'Developer Studio commit', ref, sha, head ?? '0'.repeat(sha.length)]);
    return { sha, title: title.trim() };
  } finally { await lock.close(); await unlink(lockPath); await unlink(temporary).catch(() => {}); await unlink(temporary + '.lock').catch(() => {}); }
}
