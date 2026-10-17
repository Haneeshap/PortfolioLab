export type DeveloperSession = { csrf: string; expiresAt: string; githubConnected: boolean };

// Fragments do not reach the HTTP server. Strip immediately, before exchanging,
// and never copy the bootstrap credential into persistent browser storage.
export function takeBootstrapFragment(url: string) {
  const parsed = new URL(url);
  const params = new URLSearchParams(parsed.hash.slice(1));
  const present = params.has('bootstrap');
  const value = params.get('bootstrap');
  return { present, credential: value && /^[a-f0-9]{64}$/.test(value) ? value : undefined, cleanUrl: parsed.pathname + parsed.search };
}

export function isLocalSessionExpired(code: unknown) { return code === 'SESSION_REQUIRED'; }
