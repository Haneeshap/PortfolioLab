'use client';
import { useEffect, useEffectEvent, useRef, useState } from 'react';
import hljs from 'highlight.js/lib/core';
import typescript from 'highlight.js/lib/languages/typescript';
import java from 'highlight.js/lib/languages/java';
import json from 'highlight.js/lib/languages/json';
import sql from 'highlight.js/lib/languages/sql';
import bash from 'highlight.js/lib/languages/bash';
import diffLanguage from 'highlight.js/lib/languages/diff';
import { filterChanges, diffLines, duration, type RepositoryState, type DiffResult, type CommitReview, type PushReview, type CI, type Jobs, type Analysis } from '@/lib/developer-studio';
import { takeBootstrapFragment, isLocalSessionExpired, type DeveloperSession } from '@/lib/developer-session';

const AGENT = process.env.NEXT_PUBLIC_STUDIO_AGENT_URL ?? 'http://localhost:4317';
hljs.registerLanguage('typescript', typescript); hljs.registerLanguage('java', java); hljs.registerLanguage('json', json); hljs.registerLanguage('sql', sql); hljs.registerLanguage('bash', bash); hljs.registerLanguage('diff', diffLanguage);
type Catalog = { repositories: { id: string; name: string }[]; githubConnected: boolean; githubCredential: string; ai: string };
type Tab = 'Explore' | 'Commit' | 'Push' | 'CI';
export function DiffView({ text }: { text: string }) {
  const [all, setAll] = useState(false);
  const path = /^\+\+\+ b\/(.+)$/m.exec(text)?.[1] ?? '';
  const language = /\.(tsx?|jsx?)$/.test(path) ? 'typescript' : /\.java$/.test(path) ? 'java' : /\.json$/.test(path) ? 'json' : /\.sql$/.test(path) ? 'sql' : /\.(sh|bash)$/.test(path) ? 'bash' : 'diff';
  const highlight = (line: ReturnType<typeof diffLines>[number]) => {
    if (line.kind === 'header' || language === 'diff') return hljs.highlight(line.text || ' ', { language: 'diff' }).value;
    return line.text.slice(0, 1) + hljs.highlight(line.text.slice(1) || ' ', { language }).value;
  };
  const lines = diffLines(text); const shown = all ? lines : lines.slice(0, 1200);
  return <><div className="ds-diff" tabIndex={0} aria-label="Exact unified Git diff">{shown.map((line, i) => <div key={i} className={`ds-line ds-${line.kind}`}><span className="ds-line-number">{line.old}</span><span className="ds-line-number">{line.next}</span><code dangerouslySetInnerHTML={{ __html: highlight(line) }} /></div>)}</div>{shown.length < lines.length && <button onClick={() => setAll(true)}>Render all {lines.length.toLocaleString()} lines</button>}</>;
}
function Flags({ values }: { values: string[] }) { return values.length > 0 && <ul className="ds-flags">{values.map(v => <li key={v}>{v}</li>)}</ul>; }
export default function DeveloperStudio() {
  const [csrf, setCsrf] = useState(''); const csrfRef = useRef('');
  const [expiresAt, setExpiresAt] = useState(''); const bootstrapStarted = useRef(false);
  const [catalog, setCatalog] = useState<Catalog>(); const [repo, setRepo] = useState(''); const [state, setState] = useState<RepositoryState>();
  const [tab, setTab] = useState<Tab>('Explore'); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  const [search, setSearch] = useState(''); const [status, setStatus] = useState(''); const [staging, setStaging] = useState(''); const [subsystem, setSubsystem] = useState(''); const [extension, setExtension] = useState('');
  const [selected, setSelected] = useState(''); const [layer, setLayer] = useState('unstaged'); const [preview, setPreview] = useState<DiffResult>();
  const [groupOverrides, setGroupOverrides] = useState<Record<string, string>>({});
  const [checked, setChecked] = useState<string[]>([]); const [approveStage, setApproveStage] = useState(false);
  const [review, setReview] = useState<CommitReview>(); const [title, setTitle] = useState(''); const [body, setBody] = useState(''); const [approveCommit, setApproveCommit] = useState(false);
  const [pushReview, setPushReview] = useState<PushReview>(); const [destination, setDestination] = useState(''); const [approvePush, setApprovePush] = useState(false); const [pushed, setPushed] = useState<{ sha: string; branch: string }>();
  const [ci, setCi] = useState<CI>(); const [jobs, setJobs] = useState<Jobs>(); const [runId, setRunId] = useState<number>();
  const [analysis, setAnalysis] = useState<Analysis>(); const [analyzing, setAnalyzing] = useState(false); const abort = useRef<AbortController | null>(null);
  const repoRef = useRef(repo); const previewVersion = useRef(0);
  async function api<T>(action: string, input: object = {}, signal?: AbortSignal): Promise<T> {
    const requestCsrf = csrfRef.current;
    const response = await fetch(`${AGENT}/studio/${action}`, { method: 'POST', credentials: 'include', cache: 'no-store', signal, headers: { 'Content-Type': 'application/json', ...(csrfRef.current ? { 'X-Studio-CSRF': csrfRef.current } : {}) }, body: JSON.stringify({ repo: repoRef.current, ...input }) });
    const result = await response.json();
    if (!response.ok) {
      if (isLocalSessionExpired(result.code) && requestCsrf === csrfRef.current) disconnect();
      throw new Error(result.error ?? `Agent returned ${response.status}`);
    }
    return result;
  }
  async function work(fn: () => Promise<void>) {
    setBusy(true); setError(''); setNotice('');
    try { await fn(); } catch (e) { setError(e instanceof TypeError ? 'Cannot reach local agent. Start services/developer-agent and use the configured local frontend origin.' : e instanceof Error ? e.message : 'Developer operation failed.'); }
    finally { setBusy(false); }
  }
  function invalidate() { setReview(undefined); setPushReview(undefined); setApproveCommit(false); setApprovePush(false); }
  async function refresh() { invalidate(); setPreview(undefined); setState(await api<RepositoryState>('status')); }
  function disconnect() {
    abort.current?.abort(); previewVersion.current++; csrfRef.current = ''; setCsrf(''); setExpiresAt('');
    setCatalog(undefined); setState(undefined); setPreview(undefined); setChecked([]); setApproveStage(false);
    setCi(undefined); setJobs(undefined); setAnalysis(undefined); setPushed(undefined); setAnalyzing(false); invalidate();
  }
  async function connect(credential?: string) {
    await work(async () => {
      const auth = await api<DeveloperSession>(credential ? 'bootstrap' : 'session', credential ? { credential } : {});
      csrfRef.current = auth.csrf; setCsrf(auth.csrf); setExpiresAt(auth.expiresAt);
      const list = await api<Catalog>('repos'); setCatalog(list); if (list.repositories[0]) { repoRef.current = list.repositories[0].id; setRepo(repoRef.current); setState(await api<RepositoryState>('status')); }
    });
  }
  async function refreshConnection() {
    const auth = await api<DeveloperSession>('session');
    csrfRef.current = auth.csrf; setCsrf(auth.csrf); setExpiresAt(auth.expiresAt);
    setCatalog(await api<Catalog>('repos'));
  }
  async function selectRepo(id: string) {
    abort.current?.abort(); previewVersion.current++; repoRef.current = id; setRepo(id); setState(undefined); setSelected(''); setGroupOverrides({}); setChecked([]); setPreview(undefined); setCi(undefined); setJobs(undefined); setPushed(undefined); setDestination(''); setAnalysis(undefined); invalidate();
    await work(async () => setState(await api<RepositoryState>('status')));
  }
  async function loadDiff(path: string, nextLayer = layer, expanded = false) {
    const version = ++previewVersion.current; setSelected(path); setLayer(nextLayer); setPreview(undefined); setAnalysis(undefined);
    await work(async () => { const result = await api<DiffResult>('diff', { path, layer: nextLayer, expanded }); if (version === previewVersion.current) setPreview(result); });
  }
  async function stageSelected(unstage = false) {
    await work(async () => { setState(await api<RepositoryState>(unstage ? 'unstage' : 'stage', { paths: checked, approve: approveStage })); setChecked([]); setApproveStage(false); setPreview(undefined); invalidate(); setNotice(unstage ? 'Selected files unstaged. Working files preserved.' : 'Selected files staged. Review the staged snapshot before committing.'); });
  }
  async function prepare() { await work(async () => { const r = await api<CommitReview>('prepare-commit'); setReview(r); setTitle(r.suggestion); setApproveCommit(false); }); }
  async function prepareDestination() { await work(async () => { setPushReview(await api<PushReview>('prepare-push', { destination: destination || undefined })); setApprovePush(false); }); }
  async function fetchCI(sha = pushed?.sha) { await work(async () => { setCi(await api<CI>('ci', { sha })); setJobs(undefined); setRunId(undefined); }); }
  async function explain(scope: string, hunk?: number) {
    abort.current?.abort(); const controller = new AbortController(); abort.current = controller; setAnalyzing(true); setError('');
    try { const result = await api<Analysis>('analyze', { scope, path: selected, layer, runId, hunk }, controller.signal); if (!controller.signal.aborted) setAnalysis(result); }
    catch (e) { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Analysis unavailable.'); }
    finally { if (abort.current === controller) setAnalyzing(false); }
  }
  useEffect(() => () => { abort.current?.abort(); }, []);
  const initializeSession = useEffectEvent((bootstrap: ReturnType<typeof takeBootstrapFragment>) => {
    if (bootstrap.present && !bootstrap.credential) { setError('Invalid connection link. Press R in the launcher for a new one.'); return; }
    void connect(bootstrap.credential);
  });
  const expireSession = useEffectEvent(() => { disconnect(); setError('Local session expired. Press R in the launcher to reconnect.'); });
  const refreshSessionOnFocus = useEffectEvent(() => { void work(refreshConnection); });
  useEffect(() => {
    if (bootstrapStarted.current) return;
    bootstrapStarted.current = true;
    const bootstrap = takeBootstrapFragment(window.location.href);
    if (bootstrap.present) window.history.replaceState(window.history.state, '', bootstrap.cleanUrl);
    queueMicrotask(() => initializeSession(bootstrap));
  }, []);
  useEffect(() => {
    if (!csrf || !expiresAt) return;
    const timer = window.setTimeout(() => expireSession(), Math.max(0, Date.parse(expiresAt) - Date.now()));
    const onFocus = () => refreshSessionOnFocus();
    window.addEventListener('focus', onFocus);
    return () => { window.clearTimeout(timer); window.removeEventListener('focus', onFocus); };
  }, [csrf, expiresAt]);
  const displayFiles = state?.files.map(f => ({ ...f, group: groupOverrides[f.path]?.trim() || f.group })) ?? [];
  const files = filterChanges(displayFiles, search, status, staging, subsystem, extension);
  const groups = [...new Set(files.map(f => f.group))]; const current = displayFiles.find(f => f.path === selected);
  const canWrite = !!csrf; // Expiry clears this state; the agent rechecks every operation.
  const stagedFiles = state?.files.filter(f => f.staged) ?? [];
  return <div className="ds-studio">
    <header className="ds-hero"><div><span className="ds-eyebrow">LOCAL DEVELOPMENT / M47–M49</span><h2>Developer Studio</h2><p>Understand the change. Review the snapshot. Publish with intent.</p></div><span className="ds-local">● Local agent · Developer only</span></header>
    <div aria-live="polite">{error && <div role="alert" className="ds-alert">{error}</div>}{notice && <div className="ds-notice">{notice}</div>}{busy && <p role="status">Working with the local repository…</p>}</div>
    {!csrf ? <section className="ds-panel ds-auth"><span className="ds-eyebrow">DISCONNECTED</span><h3>Connect your local developer session</h3><p>Run the launcher to open a secure, one-time connection. No local passwords are needed.</p><pre>.\scripts\start-developer-studio.ps1</pre><p>Already running? Enter <strong>R</strong> in its terminal to open a fresh connection. If this browser still has a valid session, reconnect below.</p><button disabled={busy} onClick={() => void connect()}>Reconnect existing session</button><p className="ds-muted">Agent: {AGENT}. GitHub is optional for local Git inspection and commits.</p></section> : <>
      <section className="ds-toolbar ds-panel"><label>Repository<select value={repo} disabled={busy} onChange={e => void selectRepo(e.target.value)}>{catalog?.repositories.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select></label><button disabled={busy} onClick={() => void work(refresh)}>Refresh local state</button><button disabled={busy} onClick={() => void work(refreshConnection)}>Refresh connection</button><button disabled={busy} onClick={() => void work(async () => { await api('logout'); disconnect(); setNotice('Disconnected. Press R in the launcher for a new session.'); })}>Disconnect session</button><span className="ds-muted">Connected until {new Date(expiresAt).toLocaleTimeString()}<br />GitHub: {catalog?.githubCredential ?? 'Not connected'}<br />AI: {catalog?.ai}</span><button onClick={() => setNotice('In the launcher terminal, enter G and paste your fine-grained PAT into the hidden prompt. Return here and refresh connection status. The PAT never enters your browser.')}>{catalog?.githubConnected ? 'Update GitHub connection' : 'Connect GitHub'}</button></section>
      {state && <>
        <section className="ds-repo ds-panel"><div><h3>{state.name} <span className="ds-badge">{state.branch ?? 'Detached HEAD'}</span></h3><code>{state.head?.slice(0, 12) ?? 'No commits yet'}</code><p>{state.remote ?? 'No origin configured'}</p><p className="ds-muted">Upstream: {state.upstream ?? 'Not configured'} · ↑ {state.ahead ?? '—'} ↓ {state.behind ?? '—'} · Local tracking refs</p></div><div className="ds-fresh"><span className="ds-badge">{state.clean ? 'Clean working tree' : 'Changes to review'}</span><p>Observed {new Date(state.refreshedAt).toLocaleTimeString()}</p><small>Manual refresh · no background fetch</small></div></section>
        <div className="ds-metrics">{Object.entries(state.counts).map(([name, value]) => <div className="ds-panel" key={name}><span>{name}</span><strong>{value}</strong></div>)}<div className="ds-panel" title={state.lines.scope}><span>Tracked lines</span><strong className="ds-counts">+{state.lines.added} / −{state.lines.removed}</strong><small>Net vs HEAD</small></div></div>
        <nav className="ds-tabs" aria-label="Developer workflow">{(['Explore', 'Commit', 'Push', 'CI'] as Tab[]).map((t, i) => <button key={t} aria-current={tab === t ? 'page' : undefined} onClick={() => { abort.current?.abort(); setAnalyzing(false); setTab(t); setAnalysis(undefined); }}><small>0{i + 1}</small> {t}{t === 'Commit' && <span className="ds-badge">{state.counts.staged}</span>}</button>)}</nav>
        {tab === 'Explore' && <>
          <div className="ds-toolbar ds-filters"><input aria-label="Search file paths" placeholder="Search changed file paths…" value={search} onChange={e => setSearch(e.target.value)} /><select aria-label="File status" value={status} onChange={e => setStatus(e.target.value)}><option value="">All statuses</option>{[['M', 'Modified'], ['A', 'Added'], ['D', 'Deleted'], ['R', 'Renamed'], ['?', 'Untracked'], ['conflict', 'Conflicted']].map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select><select aria-label="Staging filter" value={staging} onChange={e => setStaging(e.target.value)}><option value="">All layers</option><option value="staged">Staged</option><option value="unstaged">Unstaged</option><option value="untracked">Untracked</option></select><select aria-label="Subsystem" value={subsystem} onChange={e => setSubsystem(e.target.value)}><option value="">All subsystems</option>{[...new Set(displayFiles.map(f => f.group))].map(g => <option key={g}>{g}</option>)}</select><input aria-label="File extension" placeholder="Extension, e.g. .tsx" value={extension} onChange={e => setExtension(e.target.value)} /></div>
          <div className="ds-explorer"><aside className="ds-panel ds-file-list"><div className="ds-section-heading"><h3>Changes <span className="ds-badge">{files.length}</span></h3><button onClick={() => { setChecked(files.map(f => f.path)); setApproveStage(false); }}>Select visible</button></div><p className="ds-muted">Directory groups · deterministic</p>{!files.length && <p className="ds-empty">{state.clean ? 'Your working tree is clean.' : 'No files match these filters.'}</p>}{groups.map(g => <section key={g}><h4>{g}</h4>{files.filter(f => f.group === g).map(f => <div key={f.path} className={`ds-file ${selected === f.path ? 'ds-selected' : ''}`}><input type="checkbox" aria-label={`Select ${f.path}`} checked={checked.includes(f.path)} onChange={e => { setChecked(v => e.target.checked ? [...v, f.path] : v.filter(p => p !== f.path)); setApproveStage(false); }} /><button title={f.path} onClick={() => void loadDiff(f.path, f.unstaged || f.untracked ? 'unstaged' : 'staged')}><span>{f.path}</span><small>{f.index}{f.worktree} · {f.staged ? 'STAGED' : ''}{f.staged && (f.unstaged || f.untracked) ? ' + ' : ''}{f.untracked ? 'UNTRACKED' : f.unstaged ? 'WORKTREE' : ''}{f.conflict ? ' · CONFLICT' : ''}</small></button></div>)}</section>)}<div className="ds-stage-controls"><p>{checked.length} files selected</p><label className="ds-check"><input type="checkbox" checked={approveStage} onChange={e => setApproveStage(e.target.checked)} />I approve changing the index for these exact files.</label><div className="ds-toolbar"><button disabled={busy || !canWrite || !checked.length || !approveStage} onClick={() => void stageSelected()}>Stage selected files</button><button disabled={busy || !canWrite || !checked.length || !approveStage} onClick={() => void stageSelected(true)}>Unstage selected</button></div><p className="ds-muted">Staging includes all current changes in selected files. It can replace a partial selection made in another Git client.</p></div></aside>
          <section className="ds-panel ds-inspector">{current ? <><div className="ds-section-heading"><h3>{current.path}</h3><select aria-label="Diff layer" value={layer} onChange={e => void loadDiff(selected, e.target.value)}><option value="unstaged">Working tree diff</option><option value="staged">Staged diff</option></select></div>{current.oldPath && <p>Renamed from {current.oldPath}</p>}<label>Review group (editable for this session)<input value={groupOverrides[current.path] ?? current.group} maxLength={80} onChange={e => { setGroupOverrides(v => ({ ...v, [current.path]: e.target.value })); setSubsystem(""); }} /></label><Flags values={preview?.flags ?? current.flags} /><details open><summary>01 · Plain-English overview</summary><p>{current.untracked ? 'New file not yet tracked by Git.' : current.conflict ? 'This file has an unresolved merge conflict.' : `This file has ${current.staged ? 'staged' : 'working-tree'} changes in ${current.group.toLowerCase()}.`} Intent requires reviewing the code.</p></details><details><summary>02 · Technical context</summary><p>Index status: <code>{current.index}</code>; worktree status: <code>{current.worktree}</code>. {current.staged && current.unstaged ? 'Partially staged: inspect both layers to see what will be committed.' : 'Only staged content enters the next commit.'} API, compatibility and data flow effects are not inferred from filenames.</p></details><div className="ds-toolbar"><button disabled={analyzing} onClick={() => void explain('file')}>Explain file with local AI</button><button disabled={analyzing} onClick={() => void explain('groups')}>Suggest feature groups</button></div><details open><summary>03 · Exact unified diff</summary>{preview ? preview.binary ? <p className="ds-empty">Binary file — textual diff unavailable.</p> : <><DiffView key={`${selected}:${layer}:${preview.text.length}`} text={preview.text} />{!preview.text && <p>No textual changes in this layer.</p>}{preview.truncated && <p className="ds-alert">Preview truncated. <button onClick={() => void loadDiff(selected, layer, true)}>Expand up to 2 MiB</button> Review larger changes with your Git client.</p>}{preview.text.includes('@@ ') && <div className="ds-toolbar"><label>Explain hunk<select id="ds-hunk" defaultValue="0">{preview.text.split(/(?=^@@ )/m).filter(h => h.startsWith('@@ ')).map((h, i) => <option key={i} value={i}>{h.split('\n')[0]}</option>)}</select></label><button disabled={analyzing} onClick={() => void explain('hunk', Number((document.getElementById('ds-hunk') as HTMLSelectElement).value))}>Explain selected hunk</button></div>}</> : <p className="ds-muted">Select a file or refresh its diff.</p>}</details></> : <div className="ds-empty"><h3>Start with a changed file</h3><p>Compare the staged and working-tree layers, then select exactly what belongs in your commit.</p><button disabled={analyzing} onClick={() => void explain('summary')}>Summarize affected areas</button></div>}</section></div>
          <details className="ds-panel"><summary>Recent local commits</summary>{state.recent.map(c => <p key={c.sha}><code>{c.sha.slice(0, 10)}</code> {c.title}</p>)}</details>
        </>}
        {tab === 'Commit' && <section className="ds-panel ds-commit"><div className="ds-section-heading"><div><span className="ds-eyebrow">REVIEW THE INDEX</span><h3>Commit workspace</h3></div><button disabled={busy} onClick={() => void prepare()}>Prepare fresh commit review</button></div><p>{stagedFiles.length} staged files · Branch {state.branch ?? 'detached'} · File-level staging</p>{!review ? <div className="ds-empty">Prepare a review to capture the exact tree, file list, diff, and review flags.</div> : <><p className="ds-muted">Snapshot {review.snapshot.slice(0, 16)} · Tree {review.tree.slice(0, 12)} · {review.ref}<br />Any index or HEAD change invalidates this approval.</p><Flags values={review.flags} /><ul>{review.paths.map(p => <li key={p}><code>{p}</code></li>)}</ul><details open><summary>Exact staged diff for this snapshot</summary><DiffView key={review.snapshot} text={review.diff} /></details><div className="ds-form"><label>Commit title<input value={title} maxLength={120} onChange={e => setTitle(e.target.value)} /></label><label>Optional body<textarea value={body} maxLength={10000} onChange={e => setBody(e.target.value)} rows={4} /></label><button disabled={analyzing} onClick={() => void explain('message')}>Suggest message with local AI</button><p className="ds-muted">Git identity must already be configured. Studio uses commit-tree and skips hooks and signing; repositories requiring those must commit through their Git client.</p><label className="ds-check"><input type="checkbox" checked={approveCommit} onChange={e => setApproveCommit(e.target.checked)} />I reviewed the exact staged diff and approve this commit and message.</label><button disabled={busy || !canWrite || !approveCommit || !title.trim()} onClick={() => void work(async () => { const result = await api<{ sha: string }>('commit', { snapshot: review.snapshot, title, body, approve: true }); await refresh(); setNotice(`Commit created: ${result.sha}`); setTab('Push'); })}>Create approved commit</button></div></>}</section>}
        {tab === 'Push' && <section className="ds-panel"><span className="ds-eyebrow">EXPLICIT REMOTE APPROVAL</span><h3>Push workspace</h3><p>Preview contacts GitHub and fetches objects for an accurate divergence check. It does not pull or merge.</p><div className="ds-toolbar"><label>Destination branch (optional)<input value={destination} placeholder="Upstream branch, otherwise local branch" onChange={e => { setDestination(e.target.value); setPushReview(undefined); setApprovePush(false); }} /></label><button disabled={busy} onClick={() => void prepareDestination()}>Review outgoing commits</button></div>{pushReview && <><div className="ds-destination"><h4>{pushReview.remote}</h4><p><code>{pushReview.branch}</code> → <code>{pushReview.destination}</code></p><p>Outgoing: {pushReview.ahead} · Remote-only: {pushReview.behind} · Upstream: {pushReview.upstream ?? 'Not configured'}</p><p>{pushReview.protection}</p><small>Remote checked {new Date(pushReview.fetchedAt).toLocaleTimeString()}</small></div>{pushReview.behind > 0 && <div className="ds-alert">Remote has commits missing locally. Reconcile with your Git client; Studio will not pull, rebase, or force push.</div>}<ol>{pushReview.commits.map(c => <li key={c.sha}><code>{c.sha.slice(0, 10)}</code> {c.title}</li>)}</ol>{pushReview.commitsLimited && <p>Showing the first 30 outgoing commits.</p>}<label className="ds-check"><input type="checkbox" checked={approvePush} onChange={e => setApprovePush(e.target.checked)} />I approve pushing this reviewed commit to this remote and destination branch.</label><button disabled={busy || !canWrite || !approvePush || pushReview.behind > 0 || pushReview.ahead === 0} onClick={() => void work(async () => { const result = await api<{ sha: string; branch: string }>('push', { snapshot: pushReview.snapshot, approve: true }); setPushed(result); invalidate(); setNotice(`Git confirmed push of ${result.sha} to ${result.branch}. CI has not yet been checked.`); setTab('CI'); setCi(undefined); try { setCi(await api<CI>('ci', { sha: result.sha })); } catch (e) { setError(`Push succeeded. CI lookup failed: ${e instanceof Error ? e.message : 'Unknown error'}`); } })}>Push approved snapshot</button></>}</section>}
        {tab === 'CI' && <section className="ds-panel"><div className="ds-section-heading"><div><span className="ds-eyebrow">GITHUB ACTIONS / LIVE EVIDENCE</span><h3>CI command center</h3></div><button disabled={busy} onClick={() => void fetchCI()}>Refresh GitHub Actions</button></div>{pushed && <p>Pushed <code>{pushed.sha.slice(0, 12)}</code> to {pushed.branch}. Push success does not establish CI success.</p>}{ci ? <><p className="ds-muted">Fetched {new Date(ci.fetchedAt).toLocaleString()} · {ci.sha ? `Matched to ${ci.sha.slice(0, 12)}` : 'Current branch; first 15 runs'}</p>{!ci.runs.length && <div className="ds-empty">No matching workflow runs returned. CI may not have started, or Actions may not be configured. Refresh manually.</div>}<div className="ds-runs">{ci.runs.map(r => <article key={r.id} className={`ds-run ${runId === r.id ? 'ds-selected' : ''}`}><button onClick={() => void work(async () => { setRunId(r.id); setJobs(await api<Jobs>('ci-details', { runId: r.id })); })}><strong>{r.name}</strong><span className={`ds-status ds-status-${r.conclusion ?? r.status}`}>{r.conclusion ?? r.status}</span><small>{r.branch} · {r.sha.slice(0, 10)} · {r.event}</small><small>Started {r.startedAt ? new Date(r.startedAt).toLocaleString() : '—'} · {r.status === 'completed' ? `Last updated ${new Date(r.updatedAt).toLocaleString()}` : 'Completion pending'}</small></button><a href={r.url} target="_blank" rel="noreferrer">Open on GitHub ↗</a></article>)}</div></> : <div className="ds-empty">Fetch real GitHub Actions runs. No background polling.</div>}{jobs && <div className="ds-jobs"><h4>Jobs and steps</h4><p className="ds-muted">{jobs.evidence}</p>{jobs.limited && <p>Showing the first 30 jobs. Open GitHub for the full run.</p>}{jobs.jobs.map(j => <details open key={j.id}><summary>{j.name} · {j.conclusion ?? j.status} · {duration(j.startedAt, j.completedAt)}</summary><p><a href={j.url} target="_blank" rel="noreferrer">Source job and logs ↗</a></p>{j.steps.map(s => <div className="ds-step" key={s.number}><span>{s.number}. {s.name}</span><span className={`ds-status ds-status-${s.conclusion ?? s.status}`}>{s.conclusion ?? s.status}</span><small>{duration(s.startedAt, s.completedAt)}</small></div>)}</details>)}<Flags values={jobs.failures.map(f => `${f.job} → ${f.step}: ${f.conclusion}`)} /><button disabled={analyzing} onClick={() => void explain('ci')}>Explain failed job evidence</button></div>}</section>}
        {(analyzing || analysis) && <section className="ds-panel ds-analysis" aria-live="polite"><div className="ds-section-heading"><h3>{analyzing ? 'Reading bounded local evidence…' : 'Change explanation'}</h3>{analyzing && <button onClick={() => { abort.current?.abort(); setAnalyzing(false); }}>Cancel analysis</button>}</div>{analysis && <><span className="ds-badge">{analysis.source}</span><p className="ds-explanation">{analysis.explanation}</p><p className="ds-muted">{analysis.limitation}</p><details><summary>Evidence used</summary><pre>{JSON.stringify(analysis.evidence, null, 2)}</pre></details><p>Suggested groups and messages are advisory. You control file selection and the editable commit message.</p></>}</section>}
      </>}
    </>}
  </div>;
}
