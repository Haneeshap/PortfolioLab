# Onboarding validation — 16 October 2026

This was checked on the existing Windows development machine, **not on a clean Windows installation**. Existing node_modules, Maven/Go caches and installed toolchains were reused. No personal database dump was imported, no database schema or trading/settlement logic was changed, and no real secrets were added.

## Source inspection

Reviewed both repositories' manifests/lockfiles, TypeScript configuration, Maven wrapper/POM, Compose, Spring properties, Flyway V1–V17, Go HTTP/WebSocket server, Kafka producer/consumer/outbox configuration, frontend proxy routes and AI HTTP/MCP adapters/tests. There are no application Dockerfiles in the inspected source; Compose runs only PostgreSQL and Kafka. The native services run in separate terminals.

Installed versions observed: Node 24.12.0, npm 11.6.2, JDK 21.0.12.1, Go 1.27.0, Compose 2.40.3 and Ollama client 0.40.4. These observations do not establish a minimum supported version where the repository declares none.

## Results

| Check | Result |
| --- | --- |
| Frontend `npm.cmd run test:m34` | PASS: 27 tests. Initial sandbox run hit spawn EPERM; authorized run outside sandbox passed. |
| Frontend `npx.cmd tsc --noEmit` | PASS. |
| Frontend `npm.cmd run build` | PASS after authorized network-enabled rerun. Initial sandbox build could not fetch Geist/Geist Mono from Google Fonts. Compiled, typechecked and generated all 31 static pages successfully. |
| Frontend `npm.cmd run lint` | FAIL: 22 existing errors and 3 warnings. Includes set-state-in-effect, render purity, unescaped entities and unused variables. Application code was left unchanged. |
| AI `npm.cmd test` | PASS: 62 tests, including real MCP stdio launch. Initial sandbox child-process restriction was resolved by authorized rerun. |
| AI `npm.cmd run typecheck` | PASS. |
| AI `npm.cmd start` and GET /health | PASS on port 3101; process was stopped after checking. This does not establish Spring/MCP or Ollama runtime connectivity. |
| Go `go test ./...` | PASS. |
| Go `go mod verify` | PASS: all modules verified. |
| Backend selected unit tests | PASS: 15 tests across OrderPricingServiceTest, OrderPreviewServiceTest and ReconciliationServiceTests; compiled main/test Java sources. |
| Compose config | PASS: `docker compose config --quiet` with a temporary nonsecret DB_PASSWORD process value. |
| Backend PowerShell launcher | PASS: PowerShell AST parsing; no actual database-backed launch claimed. |
| Ignore rules | Confirmed root .env and frontend .env.local are ignored; frontend .env.example is allowed after fixing its nested ignore rule. |

Exact backend command, from backend:

```powershell
.\mvnw.cmd '-Dtest=OrderPricingServiceTest,OrderPreviewServiceTest,ReconciliationServiceTests' test
```

The sandbox initially blocked Maven cache locks; an authorized rerun outside the sandbox succeeded. Maven emitted metadata HTTP 401 warnings for Flyway-related repositories but completed compilation/tests. A cache-free Maven installation/download has not been tested.

## Checks still requiring a running local stack

- Docker Desktop's Linux engine was unavailable (named pipe not found). Database/Kafka container startup, image download availability, broker CLI topic commands, Flyway on an empty volume, full Spring integration tests and browser-to-database demo flow were not run.
- The reconciliation SQL integration test requires a filled simulated order/execution receipt with initially consistent evidence. A clean seed database alone does not satisfy it. Its test mutation rolls back; creating the demo trade is a separate persistent action.
- Ollama client was installed but its server was not running. Model installation and real model inference were not verified. AI unit tests mock upstreams; they do not establish model availability.
- `go run .` was attempted but did not produce a startup message or respond on port 8081 during the check; it was stopped. Go tests and module verification passed, but simulator runtime/REST/WebSocket startup remains unverified.
- Neither npm dependency tree was reinstalled from scratch. The documented npm ci commands match committed lockfiles; package availability without local caches remains unverified.
- The AI checkout has no Git remote. Its actual clone URL, publication and another developer's access must be supplied by the maintainer.
- Existing tracked audit/backup artifacts were observed and left untouched. New ignore rules do not remove tracked files or scrub history. Review existing tracked exports before sharing the repository; do not reuse its historical fixed development credentials.

No claim of a fully reproducible clean installation is made. The README supplies the remaining manual steps and troubleshooting so a fresh-machine run can be recorded separately.
