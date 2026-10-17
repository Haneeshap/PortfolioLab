import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { GitHub } from './github.ts';
import { requireValue } from './security.ts';

export const BOOTSTRAP_LIFETIME_MS = 2 * 60_000;
export const SESSION_LIFETIME_MS = 30 * 60_000;
export type Session = {
  csrf: string;
  expires: number;
  github: GitHub;
  reviews: Map<string, { repo: string; kind: string; expires: number; destination?: string }>;
};

// The launcher controls this object through private stdin, never an HTTP endpoint.
export class LocalSessions {
  private bootstrap?: { digest: Buffer; expires: number };
  private sessions = new Map<string, Session>();
  private pendingGitHub: GitHub;
  private attempts: number[] = [];
  readonly now: () => number;

  constructor(credential: string, github: GitHub, now = Date.now) {
    this.now = now;
    this.pendingGitHub = new GitHub('', github.fetcher);
    this.rotate(credential);
    this.pendingGitHub.token = github.token;
    github.token = '';
  }

  rotate(credential: string) {
    requireValue(/^[a-f0-9]{64}$/.test(credential), 'Launcher must generate a fresh 256-bit bootstrap credential.');
    this.clear();
    this.bootstrap = { digest: createHash('sha256').update(credential).digest(), expires: this.now() + BOOTSTRAP_LIFETIME_MS };
  }

  exchange(credential: unknown) {
    const now = this.now();
    this.attempts = this.attempts.filter(t => t > now - 60_000);
    requireValue(this.attempts.length < 10, 'Too many connection attempts. Wait one minute, then press R in the launcher.', 429);
    this.attempts.push(now);
    requireValue(typeof credential === 'string' && /^[a-f0-9]{64}$/.test(credential), 'Invalid local bootstrap. Press R in the launcher to reconnect.', 401);
    requireValue(this.bootstrap && this.bootstrap.expires > now && timingSafeEqual(this.bootstrap.digest, createHash('sha256').update(credential).digest()), 'Bootstrap expired or already used. Press R in the launcher to reconnect.', 401);
    this.bootstrap = undefined; // Consume before any asynchronous work: replay cannot win a race.
    const id = randomBytes(32).toString('hex');
    const session: Session = { csrf: randomBytes(32).toString('hex'), expires: now + SESSION_LIFETIME_MS, github: new GitHub(this.pendingGitHub.token, this.pendingGitHub.fetcher), reviews: new Map() };
    this.pendingGitHub.token = '';
    this.sessions.set(id, session);
    return { id, session };
  }

  get(id?: string) {
    for (const [key, session] of this.sessions) if (session.expires <= this.now()) this.remove(key);
    if (this.bootstrap && this.bootstrap.expires <= this.now()) { this.bootstrap = undefined; this.pendingGitHub.token = ''; }
    return id ? this.sessions.get(id) : undefined;
  }

  connectGitHub(token: string) {
    requireValue(/^github_pat_[A-Za-z0-9_]+$/.test(token), 'Provide a fine-grained GitHub PAT; classic tokens are not supported.');
    this.get();
    const active = [...this.sessions.values()][0];
    requireValue(active || this.bootstrap, 'No active developer session. Press R in the launcher before connecting GitHub.');
    (active?.github ?? this.pendingGitHub).token = token;
  }

  remove(id: string) {
    const session = this.sessions.get(id);
    if (session) { session.github.token = ''; session.reviews.clear(); }
    this.sessions.delete(id);
  }

  clear() {
    for (const id of this.sessions.keys()) this.remove(id);
    if (this.pendingGitHub) this.pendingGitHub.token = '';
    this.bootstrap = undefined;
  }
}
