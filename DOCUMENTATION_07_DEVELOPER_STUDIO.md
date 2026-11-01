# DOCUMENTATION 07 — Developer Studio Deep Dive

## 1. Overview

- **Location:** `services/developer-agent/` + `frontend/src/app/developer/`
- **Route:** `/developer` on Next.js frontend (port 3000)
- **Agent port:** `4317` on `127.0.0.1` (loopback only)
- **Language:** Node.js/TypeScript (native node:http, child_process, crypto, fs/promises)
- **No agent npm dependencies** — uses only Node standard library
- **Launcher:** `.\scripts\start-developer-studio.ps1` (PowerShell)

## 2. Architecture

```
Developer (Browser:3000) --> /developer UI --> Agent (127.0.0.1:4317)
                                              │
                                              ├─> Local Git repositories (read-only roots)
                                              ├─> GitHub (via fine-grained PAT, HTTPS only)
                                              └─> Local Ollama (optional, for analysis)
```

- Origin restriction: agent only accepts requests from `http://localhost:3000` (not 127.0.0.1:3000 — different cookie site)
- CSRF tokens per session
- Session bootstrap: 2-minute one-time credential; expires if unused
- GitHub: optional fine-grained PAT via hidden terminal prompt (never in browser)
- Git hooks disabled (`core.hooksPath=/dev/null`), GPG signing disabled
- No force push, no pull, no rebase

## 3. Source Files (services/developer-agent/src/)

| File | Purpose |
|------|---------|
| `server.ts` | HTTP server, session management, tool dispatch, lifecycle |
| `sessions.ts` | LocalSessions: bootstrap credential, session CSRF, expiry, GitHub token |
| `git.ts` | Git operations: loadRepositories, overview, changed, diff, stage, prepareCommit, commit |
| `github.ts` | GitHub API client: identity, runs, details, preparePush, push |
| `security.ts` | StudioError, requireValue, equalSecret, redact, sensitivePath, flags, group |
| `analysis.ts` | Read tools: get_repository_status, list_changed_files, get_file_diff, etc.; Ollama analysis |

## 4. Key Features

### Repository Inspection
- `get_repository_status` / `get_branch_status` — branch, HEAD, counts (staged/unstaged/untracked), upstream
- `list_changed_files` — path, oldPath, index/worktree state, staged/unstaged/untracked/conflict flags, group
- `get_file_diff` — exact diff text (bounded 16 KiB per file), redacted credentials
- `get_change_summary` — deterministic directory grouping (not inferred intent)
- `get_recent_commits` — commit history
- `get_ci_runs` / `get_ci_run_details` — GitHub Actions runs

### Commit Workflow
- `prepare_commit_review` — stages diff, validates no conflicts, checks tree changed, returns snapshot hash, suggested message, paths, flags
- `commit` — validates snapshot matches (prevents stale commit), writes-tree via temp index, commit-tree, update-ref
- No automatic retry; user must prepare fresh review if repo changed

### Push Workflow
- `prepare_push_review` — checks ahead/behind vs remote, lists outgoing commits, validates ref format
- `push` — validates snapshot, requires ahead>0 and behind=0, pushes via `--porcelain --no-verify`
- Push helper uses `GIT_ASKPASS` with hidden Node script for PAT input (never in arguments)

### Analysis (Optional Ollama)
- Scopes: summary, file, hunk, groups, message, ci
- System prompt: "You explain PortfolioLab development evidence. You have no write tools or authority."
- Evidence is untrusted data; model must not invent intent or root causes
- Falls back to deterministic evidence if Ollama unavailable

## 5. Security

- `StudioError` with status codes and error codes
- `requireValue(condition, message, status)` — assertion helper
- `equalSecret(a, b)` — timing-safe comparison using SHA-256
- `redact(text)` — redacts private keys, GitHub PATs, AWS keys, passwords/tokens in URLs and key=value pairs
- `sensitivePath(path)` — detects .env, .npmrc, credentials, id_rsa, .pem, .key, .p12, .pfx files
- `flags(path)` — flags credential files, DB migrations, auth code, CI workflows, dependency manifests, lockfiles
- `group(path)` — categorizes files: Tests, Database migrations, Documentation, Developer tooling, Frontend, Backend, AI integrations, Infrastructure, Configuration

## 6. Session Management

- `BOOTSTRAP_LIFETIME_MS = 2 minutes`
- `SESSION_LIFETIME_MS = 30 minutes`
- Bootstrap: 256-bit credential (64 hex chars), SHA-256 digest, single-use (consumed before async work)
- Session: CSRF token (32 bytes hex), expiry, GitHub instance, reviews map
- `connectGitHub(token)` — validates `github_pat_*` format, sets token on active session
- `clear()` — wipes all tokens and sessions
- Rate limiting: max 10 connection attempts per minute

## 7. Launcher (start-developer-studio.ps1)

- Starts frontend (`npm run dev` on port 3000) first
- Then launches agent with bootstrap credential, optional GitHub token, optional Ollama model
- Options: `-GitHubCredential`, `-IncludeAiRepository`, `-OllamaModel`, `-Port`
- Interactive keys: **R** (reconnect/bootstrap), **G** (enter GitHub PAT), **Q** (stop agent)
- Outputs `STUDIO_READY`, `STUDIO_BOOTSTRAP_READY`, `STUDIO_GITHUB_CONNECTED`, `STUDIO_ERROR` on stdout
- Opens browser directly at Developer Studio with one-time bootstrap