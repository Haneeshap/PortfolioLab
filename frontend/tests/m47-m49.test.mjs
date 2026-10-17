import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import DeveloperStudio, { DiffView } from '../src/components/DeveloperStudio.tsx';
import { diffLines, filterChanges, duration } from '../src/lib/developer-studio.ts';
import { takeBootstrapFragment, isLocalSessionExpired } from '../src/lib/developer-session.ts';
test('developer workspace starts behind independent local authentication', () => {
  const html = renderToStaticMarkup(createElement(DeveloperStudio)); assert.match(html, /DISCONNECTED/); assert.match(html, /Reconnect existing session/); assert.match(html, /start-developer-studio/); assert.doesNotMatch(html, /type="password"|write passphrase|read passphrase|Create approved commit/);
});
test('exact diff rendering preserves content and old/new line numbers', () => {
  const source = 'diff --git a/x b/x\n--- a/x\n+++ b/x\n@@ -3,2 +3,2 @@\n same\n-old\n+new\n';
  const lines = diffLines(source); assert.equal(lines.map(l => l.text).join('\n'), source); assert.equal(lines[4].old, 3); assert.equal(lines[5].old, 4); assert.equal(lines[6].next, 4);
});
test('filters retain partially staged, untracked and conflicted files', () => {
  const base = { oldPath: undefined, index: 'M', worktree: 'M', staged: true, unstaged: true, untracked: false, conflict: false, group: 'Frontend', flags: [] };
  const files = [{ ...base, path: 'frontend/a.tsx' }, { ...base, path: '.env', index: '?', worktree: '?', staged: false, unstaged: false, untracked: true }, { ...base, path: 'backend/conflict.java', group: 'Backend', conflict: true, index: 'U' }];
  assert.equal(filterChanges(files, '', '', '', '', '').length, 3); assert.equal(filterChanges(files, 'frontend', 'M', 'staged', 'Frontend', '.tsx').length, 1); assert.equal(filterChanges(files, '', '?', 'untracked', '', '').length, 1); assert.equal(filterChanges(files, '', 'conflict', '', '', '').length, 1);
});
test('timing handles unavailable and completed CI jobs', () => { assert.equal(duration(null, null), '—'); assert.equal(duration('2026-01-01T00:00:00Z', '2026-01-01T00:01:15Z'), '1m 15s'); });
test('syntax highlighted diff escapes repository HTML instead of executing it', () => {
  const html = renderToStaticMarkup(createElement(DiffView, { text: '+++ b/test.ts\n@@ -1 +1 @@\n+const example = "<script>alert(1)</script>";' }));
  assert.match(html, /hljs-keyword/); assert.match(html, /&lt;script&gt;/); assert.doesNotMatch(html, /<script>/);
});
test('bootstrap fragment is stripped, validated, and never becomes a query parameter', () => {
  const parsed = takeBootstrapFragment('http://localhost:3000/developer?view=changes#bootstrap=' + 'a'.repeat(64));
  assert.equal(parsed.credential, 'a'.repeat(64)); assert.equal(parsed.cleanUrl, '/developer?view=changes'); assert.equal(parsed.present, true);
  assert.equal(takeBootstrapFragment('http://localhost:3000/developer#bootstrap=github_pat_fake').credential, undefined);
  assert.equal(takeBootstrapFragment('http://localhost:3000/developer').present, false);
});
test('GitHub authentication errors do not invalidate the local developer session', () => {
  assert.equal(isLocalSessionExpired('SESSION_REQUIRED'), true); assert.equal(isLocalSessionExpired(undefined), false); assert.equal(isLocalSessionExpired('GITHUB_UNAUTHORIZED'), false);
});
