export type FileChange = { path: string; oldPath?: string; index: string; worktree: string; staged: boolean; unstaged: boolean; untracked: boolean; conflict: boolean; group: string; flags: string[] };
export type RepositoryState = { id: string; name: string; branch: string | null; head: string | null; remote: string | null; upstream: string | null; ahead: number | null; behind: number | null; files: FileChange[]; clean: boolean; refreshedAt: string; trackingFreshness: string; counts: { staged: number; unstaged: number; untracked: number; total: number }; lines: { added: number; removed: number; scope: string }; recent: { sha: string; title: string }[] };
export type DiffResult = { text: string; truncated: boolean; binary: boolean; large?: boolean; flags: string[] };
export type CommitReview = { snapshot: string; tree: string; head: string | null; ref: string; paths: string[]; diff: string; suggestion: string; flags: string[] };
export type PushReview = { snapshot: string; head: string; branch: string; remote: string; destination: string; remoteHead: string | null; ahead: number; behind: number; upstream: string | null; commits: { sha: string; title: string }[]; commitsLimited: boolean; protection: string; fetchedAt: string };
export type Run = { id: number; name: string; branch: string; sha: string; event: string; status: string; conclusion: string | null; startedAt: string; updatedAt: string; url: string };
export type CI = { fetchedAt: string; sha: string | null; runs: Run[] };
export type Step = { number: number; name: string; status: string; conclusion: string | null; startedAt: string | null; completedAt: string | null };
export type Job = { id: number; name: string; status: string; conclusion: string | null; startedAt: string | null; completedAt: string | null; url: string; steps: Step[] };
export type Jobs = { fetchedAt: string; jobs: Job[]; limited: boolean; failures: { job: string; step: string; conclusion: string; url: string }[]; evidence: string };
export type Analysis = { source: string; explanation: string; limitation?: string; evidence: unknown };
export function filterChanges(files: FileChange[], search: string, status: string, staging: string, subsystem: string, extension: string) {
  return files.filter(f => f.path.toLowerCase().includes(search.toLowerCase()) && (!subsystem || f.group === subsystem) && (!extension || f.path.endsWith(extension)) && (!status || (status === 'conflict' ? f.conflict : status === '?' ? f.untracked : (f.index + f.worktree).includes(status))) && (!staging || (staging === 'staged' ? f.staged : staging === 'untracked' ? f.untracked : f.unstaged)));
}
export type DiffLine = { text: string; kind: 'add' | 'remove' | 'context' | 'header'; old: number | null; next: number | null };
export function diffLines(text: string): DiffLine[] {
  let old = 0, next = 0;
  return text.split('\n').map(text => {
    const hunk = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(text);
    if (hunk) { old = +hunk[1]; next = +hunk[2]; }
    if (hunk || /^(diff |index |--- |\+\+\+ |new file |deleted file |rename |similarity |Binary |\\)/.test(text)) return { text, kind: 'header', old: null, next: null };
    if (text.startsWith('+')) return { text, kind: 'add', old: null, next: next++ };
    if (text.startsWith('-')) return { text, kind: 'remove', old: old++, next: null };
    if (text.startsWith(' ')) return { text, kind: 'context', old: old++, next: next++ };
    return { text, kind: 'header', old: null, next: null };
  });
}
export function duration(start: string | null, end: string | null) {
  if (!start || !end) return '—';
  const seconds = Math.max(0, Math.round((Date.parse(end) - Date.parse(start)) / 1000));
  return Number.isFinite(seconds) ? `${Math.floor(seconds / 60)}m ${seconds % 60}s` : '—';
}
