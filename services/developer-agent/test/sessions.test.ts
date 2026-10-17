import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LocalSessions, BOOTSTRAP_LIFETIME_MS, SESSION_LIFETIME_MS } from '../src/sessions.ts';
import { GitHub } from '../src/github.ts';
import { gitEnvironment } from '../src/git.ts';

test('bootstrap is random-format, single use, expires, and never accepts a PAT as login', () => {
  let now = Date.now();
  const auth = new LocalSessions('a'.repeat(64), new GitHub(), () => now);
  assert.throws(() => auth.exchange('github_pat_test_fixture'), /Invalid local bootstrap/);
  const { id, session } = auth.exchange('a'.repeat(64));
  assert.equal(auth.get(id), session); assert.equal(session.expires, now + SESSION_LIFETIME_MS);
  assert.notEqual(id, 'a'.repeat(64)); assert.notEqual(session.csrf, id);
  assert.throws(() => auth.exchange('a'.repeat(64)), /already used/);
  auth.rotate('b'.repeat(64)); assert.equal(auth.get(id), undefined);
  now += BOOTSTRAP_LIFETIME_MS;
  assert.throws(() => auth.exchange('b'.repeat(64)), /expired/);
  assert.throws(() => auth.rotate('weak'), /256-bit/);
});

test('session expiration, reconnect and logout discard credentials and reviews', () => {
  let now = Date.now(); const github = new GitHub('github_pat_initial_fixture');
  const auth = new LocalSessions('c'.repeat(64), github, () => now);
  assert.equal(github.token, '');
  const first = auth.exchange('c'.repeat(64)); assert.equal(first.session.github.token, 'github_pat_initial_fixture');
  auth.connectGitHub('github_pat_updated_fixture');
  first.session.reviews.set('approved', { repo: 'test', kind: 'commit', expires: now + 1000 });
  now += SESSION_LIFETIME_MS;
  assert.equal(auth.get(first.id), undefined); assert.equal(first.session.github.token, ''); assert.equal(first.session.reviews.size, 0);
  assert.throws(() => auth.connectGitHub('github_pat_expired_fixture'), /No active/);
  auth.rotate('d'.repeat(64)); auth.connectGitHub('github_pat_pending_fixture');
  const next = auth.exchange('d'.repeat(64)); assert.equal(next.session.github.token, 'github_pat_pending_fixture');
  auth.remove(next.id); assert.equal(auth.get(next.id), undefined); assert.equal(next.session.github.token, '');
});

test('unknown credentials are throttled without consuming the valid bootstrap', () => {
  let now = Date.now(); const auth = new LocalSessions('e'.repeat(64), new GitHub(), () => now);
  for (let i = 0; i < 10; i++) assert.throws(() => auth.exchange('0'.repeat(64)), /expired or already used/);
  assert.throws(() => auth.exchange('e'.repeat(64)), /Too many/);
  now += 60_001; assert.ok(auth.exchange('e'.repeat(64)).id);
});
test('ordinary Git subprocesses do not inherit launcher or MCP credentials', () => {
  const previous = process.env.STUDIO_MCP_SECRET;
  try {
    process.env.STUDIO_MCP_SECRET = 'private-test-fixture';
    assert.equal(gitEnvironment().STUDIO_MCP_SECRET, undefined);
    assert.equal(gitEnvironment({ STUDIO_GITHUB_TOKEN: 'explicit-askpass-fixture' }).STUDIO_GITHUB_TOKEN, 'explicit-askpass-fixture');
  } finally { if (previous === undefined) delete process.env.STUDIO_MCP_SECRET; else process.env.STUDIO_MCP_SECRET = previous; }
});
