import { createHash, timingSafeEqual } from 'node:crypto';
export class StudioError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status = 400, code?: string) { super(message); this.status = status; this.code = code; }
}
export function requireValue(condition: unknown, message: string, status = 400): asserts condition {
  if (!condition) throw new StudioError(message, status);
}
export function equalSecret(a: string, b: string) {
  return timingSafeEqual(createHash('sha256').update(a).digest(), createHash('sha256').update(b).digest());
}
export function sensitivePath(path: string) {
  return /(^|\/)(\.env(?:\..*)?|\.npmrc|\.netrc|credentials(?:\..*)?|id_rsa|id_ed25519)$|\.(pem|key|p12|pfx)$/i.test(path);
}
export function redact(text: string) {
  return text.replace(/-----BEGIN [^-]*PRIVATE KEY-----[\s\S]*?(?:-----END [^-]*PRIVATE KEY-----|$)/g, '[REDACTED PRIVATE KEY]')
    .replace(/\b(?:github_pat_[A-Za-z0-9_]+|gh[pousr]_[A-Za-z0-9]+|AKIA[A-Z0-9]{16})\b/g, '[REDACTED CREDENTIAL]')
    .replace(/((?:password|passwd|secret|token|api[_-]?key|authorization)\s*["']?\s*[:=]\s*)[^\r\n]+/gi, '$1[REDACTED]')
    .replace(/https?:\/\/[^\s/@]+:[^\s/@]+@/g, 'https://[REDACTED]@');
}
export function flags(path: string, conflict = false) {
  return [conflict && 'Merge conflict present', sensitivePath(path) && 'Credential-related file — contents excluded from AI',
    /migration|flyway|\/db\//i.test(path) && 'Database migration changed', /auth|security|permission/i.test(path) && 'Authorization-sensitive code changed',
    /^\.github\/workflows\//.test(path) && 'CI workflow changed', /(^|\/)(package\.json|pom\.xml|go\.mod)$/.test(path) && 'Dependency manifest changed',
    /lock/.test(path) && 'Lockfile changed'].filter((x): x is string => !!x);
}
export function group(path: string) {
  if (/test|spec/i.test(path)) return 'Tests';
  if (/migration|flyway/i.test(path)) return 'Database migrations';
  if (/^docs\/|\.md$/.test(path)) return 'Documentation';
  if (/developer-agent|\/developer\//.test(path)) return 'Developer tooling';
  if (/^frontend\//.test(path)) return 'Frontend';
  if (/^backend\//.test(path)) return 'Backend';
  if (/ai|mcp/i.test(path)) return 'AI integrations';
  if (/^\.github|compose|docker/i.test(path)) return 'Infrastructure';
  return 'Configuration & other';
}
