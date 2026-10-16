# PortfolioLab

PortfolioLab is a local educational portfolio and simulated trading system. A Next.js dashboard combines a Spring Boot API, Go price simulator, PostgreSQL, Kafka notifications, and a separate Node.js Ask AI service using Ollama and MCP. It never connects to an exchange or moves real money.

## Features and architecture

- Portfolio cash, holdings, allocation, valuation, performance history and transactions.
- Simulated buy/sell previews, pre-trade risk checks, order lifecycle, execution receipts and reconciliation.
- Live simulated prices, watchlists, price alerts, market intelligence and persistent notifications.
- Dividend/bonus calculations, dividend scheduling, business rules and FX conversion/attribution.
- Ask AI educational explanations, holdings analysis and read-only order/reconciliation evidence.

```text
Browser :3000 --> Next.js API routes --> Spring Boot :8080 --> PostgreSQL :5432
    |                   |
    |                   +--> AI :3101 --> MCP stdio child --> Spring Boot
    |                              +---> Ollama :11434
    +--WebSocket--> Go :8081 <--HTTP-- Spring Boot
Spring outbox --> Kafka :9092 --> notification consumer --> PostgreSQL --> UI polling
```

| Source | Stack declared in repository |
| --- | --- |
| `frontend/` | Next.js 16.4.0 App Router, React 19.3.0, TypeScript 5, Tailwind 4, Recharts; npm lockfile |
| `backend/` | Java 21, Spring Boot 4.1.1, MVC/JPA, Flyway, PostgreSQL driver, Spring Kafka; Maven wrapper 3.10.0 |
| `services/market-simulator/` | Go 1.27.0, coder/websocket; go.mod/go.sum |
| `compose.yaml` | PostgreSQL 17, Apache Kafka 3.9.1, named volumes and loopback host ports |
| sibling `portfoliolab-ai/` | Node/TypeScript, tsx, MCP client/server SDK 2.3.1 range, Zod; Ollama qwen2.5:0.5b |

Flyway automatically applies migrations V1–V17 under `backend/src/main/resources/db/migration`. They seed assets and INR Demo Portfolio (ID 1, initial cash 100000), then add history, FX, outbox/notifications, events, alerts, watchlists, intelligence, risk policies and simulated orders/executions. A fresh database has no traded holdings or execution receipts. Hibernate validates the schema; no database dump or manual table creation is needed.

Some Java files sit in unusually deep repeated source paths. Maven still compiles below its source root; search by class name when navigating. Backups are not application components.

## Install on Windows

Use native Windows PowerShell 5.1 or PowerShell 7. The AI MCP launcher explicitly invokes `npx.cmd`. Install these tools, then reopen your terminal:

| Tool | Requirement |
| --- | --- |
| [Git for Windows](https://git-scm.com/downloads/win) | Git 2.x and access to both repositories |
| [Node.js](https://nodejs.org/en/download) | Use 24.x with bundled npm 11.x, matching the inspected machine. Next 16 requires >=20.9; AI declares no minimum Node version. Node 24 is the common onboarding baseline. |
| [JDK](https://adoptium.net/temurin/releases/?version=21) | JDK 21, with JAVA_HOME and PATH configured; a JRE alone is insufficient |
| [Go](https://go.dev/dl/) | 1.27.0 or compatible newer toolchain, required by go.mod |
| [Docker Desktop](https://docs.docker.com/desktop/setup/install/windows-install/) | Linux containers, WSL 2/virtualization enabled, Compose v2; inspected Compose was 2.40.3 |
| [Ollama for Windows](https://ollama.com/download/windows) | Model `qwen2.5:0.5b`; no minimum Ollama version is declared. Inspected client: 0.40.4. |

No separate Maven, PostgreSQL, Kafka, Python, global TypeScript or global tsx installation is needed. First installs require internet for Maven/npm/Go dependencies, Docker images and the model. Fresh registry availability of every pinned version has not been verified: report missing artifacts rather than changing versions silently.

```powershell
git --version
node --version
npm.cmd --version
java -version
go version
docker compose version
ollama --version
```

## Clone both repositories

Open PowerShell in a parent directory of your choice:

```powershell
git clone https://github.com/Nandantechgeek/PortfolioLab.git PortfolioLab
$aiRepositoryUrl = Read-Host 'Paste the actual portfoliolab-ai Git clone URL'
git clone $aiRepositoryUrl portfoliolab-ai
Set-Location PortfolioLab
```

The two directories must be siblings. **The inspected AI repository has no configured Git remote.** Its clone URL cannot be verified; the maintainer must publish/share it and grant access first. Do not assume its GitHub owner or URL.

## First-time configuration and installation

From the main root:

```powershell
Copy-Item .env.example .env
notepad .env
Copy-Item frontend/.env.example frontend/.env.local
```

Set DB_PASSWORD to your own unique value of at least 16 letters/digits, unquoted, on one line. Never commit `.env`. Compose automatically reads the root `.env`; Spring does not. The supplied backend launcher loads that password into the backend process. Spring's source fallback password is not the onboarding password.

Next automatically reads `frontend/.env.local`. Only some routes honor BACKEND_URL; other backend routes, Go REST/WebSocket clients, AI clients and Kafka factories use hardcoded addresses. Keep the ports below. AI and Go read no environment settings: invented PORT/OLLAMA_MODEL/AI_SERVICE_URL variables will have no effect.

```powershell
# From PortfolioLab; check each command succeeds before continuing.
Push-Location frontend
npm.cmd ci
Pop-Location
Push-Location backend
.\mvnw.cmd -DskipTests package
Pop-Location
Push-Location services/market-simulator
go mod download
go mod verify
Pop-Location
Push-Location ../portfoliolab-ai
npm.cmd ci
npm.cmd run typecheck
Pop-Location
ollama pull qwen2.5:0.5b
```

`npm.cmd ci` installs each lockfile. The Maven wrapper downloads Maven 3.10.0; `-DskipTests package` compiles/packages without database-dependent tests.

## Startup order — every day

Start Docker Desktop and wait for its Linux engine. Use a separate terminal for each long-running service and leave it open.

**1. Infrastructure, from the main root:**

```powershell
docker compose up -d postgres kafka
docker compose ps
docker compose exec postgres pg_isready -U portfoliolab -d portfoliolab
docker compose exec kafka /opt/kafka/bin/kafka-topics.sh --bootstrap-server localhost:9092 --list
```

Wait for PostgreSQL to become healthy; retry Kafka's list command until successful. Kafka has no Compose healthcheck. Auto topic creation is disabled, so create both topics (safe to repeat):

```powershell
docker compose exec kafka /opt/kafka/bin/kafka-topics.sh --bootstrap-server localhost:9092 --create --if-not-exists --topic portfoliolab.notifications.v1 --partitions 1 --replication-factor 1
docker compose exec kafka /opt/kafka/bin/kafka-topics.sh --bootstrap-server localhost:9092 --create --if-not-exists --topic portfoliolab.market-intelligence.v1 --partitions 1 --replication-factor 1
docker compose exec kafka /opt/kafka/bin/kafka-topics.sh --bootstrap-server localhost:9092 --list
```

**2. Simulator, from `PortfolioLab/services/market-simulator`:**

```powershell
go run .
```

**3. Backend, from the main root:**

```powershell
.\scripts\Start-Backend.ps1
```

Wait for Spring startup and a successful `/api/health`. Flyway runs automatically. If script execution is blocked, review the script and use a process-only override: `powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\Start-Backend.ps1`. No machine-wide policy change is required.

**4. Ollama:** Open the installed app. If its server is not already running, use another terminal:

```powershell
ollama serve
```

Address-in-use usually means it already runs in the tray. Check `Invoke-RestMethod http://127.0.0.1:11434/api/tags` lists qwen2.5:0.5b.

**5. AI, from sibling `portfoliolab-ai` root:**

```powershell
npm.cmd start
```

MCP children launch automatically over stdio; no MCP HTTP server, API key or extra port is needed. The working directory matters because the launcher resolves `src/mcp-server.ts` there. See the AI repository's README for tool details.

**6. Frontend, from `PortfolioLab/frontend`:**

```powershell
npm.cmd run dev
```

Open **http://localhost:3000**. If Next selects 3001, stop the process occupying 3000 and restart for a consistent demo.

| Service | URL/port and useful endpoints |
| --- | --- |
| Frontend | http://localhost:3000 — `/portfolio`, `/markets`, `/watchlists`, `/notifications`, `/intelligence`, `/fx` |
| Spring | http://127.0.0.1:8080 — `/api/health`, `/api/assets`, `/api/portfolios/1` |
| Go | http://127.0.0.1:8081 — `/health`, `/prices`; ws://localhost:8081/ws/prices every 5 seconds |
| AI | http://127.0.0.1:3101 — `/health`, `/api/portfolio/holdings?portfolioId=1` |
| Ollama | http://127.0.0.1:11434 — `/api/tags` |
| PostgreSQL | localhost:5432; database/user `portfoliolab`, password from `.env` |
| Kafka | localhost:9092; single KRaft node, internal controller 9093 |

Later launches reuse dependencies, `.env` and persistent volumes; no reinstall or restore is needed unless configuration/manifests change. Stop terminal processes with Ctrl+C, then `docker compose stop` from the main root. **`docker compose down -v` erases the local database and Kafka volumes**; it is not a normal restart command.

## Service verification and tests

With everything running:

```powershell
Invoke-RestMethod http://127.0.0.1:8081/health
Invoke-RestMethod http://127.0.0.1:8081/prices
Invoke-RestMethod http://127.0.0.1:8080/api/health
Invoke-RestMethod http://127.0.0.1:8080/api/assets
Invoke-RestMethod http://127.0.0.1:8080/api/portfolios/1/holdings
Invoke-RestMethod http://127.0.0.1:3101/health
Invoke-RestMethod 'http://127.0.0.1:3101/api/portfolio/holdings?portfolioId=1'
$chat = @{portfolioId=1; message='Summarize my portfolio holdings'} | ConvertTo-Json
Invoke-RestMethod http://127.0.0.1:3101/api/portfolio/chat -Method Post -ContentType application/json -Body $chat
Invoke-RestMethod http://localhost:3000/api/ai/chat -Method Post -ContentType application/json -Body $chat
```

Empty holdings are valid before a filled trade. Health responses only prove the process responds; the holdings call tests MCP/Spring and the chat call also tests model inference.

Run checks from the main root:

```powershell
Push-Location frontend
npm.cmd run test:m34
npm.cmd run lint
npx.cmd tsc --noEmit
npm.cmd run build
# After a successful build, optional production-style UI: npm.cmd start
Pop-Location
Push-Location services/market-simulator
go test ./...
Pop-Location
Push-Location ../portfoliolab-ai
npm.cmd test
npm.cmd run typecheck
Pop-Location
# Export the same password as .env for this test terminal; input is masked.
$securePassword = Read-Host 'DB_PASSWORD from your .env' -AsSecureString
$env:DB_PASSWORD = [System.Net.NetworkCredential]::new('', $securePassword).Password
Push-Location backend
.\mvnw.cmd test
Pop-Location
Remove-Item Env:DB_PASSWORD
```

Backend Spring integration tests use the configured development PostgreSQL database, not a disposable isolated fixture. `ReconciliationSqlIntegrationTests` requires an existing filled simulated order/execution receipt with initially consistent evidence. Make a small simulated buy through the UI before the full suite; its mismatch mutation rolls back. For an initial run before that fixture exists, explicitly exclude it with `.\mvnw.cmd '-Dtest=*,!ReconciliationSqlIntegrationTests' test` and record that exclusion. AI tests mock HTTP evidence and test real MCP stdio discovery; Ollama is not required for those tests.

See [ONBOARDING-VALIDATION.md](docs/ONBOARDING-VALIDATION.md) for actual results, existing failures and checks that could not run.

## Five-minute demonstration and discussion guide

1. Explain the architecture: Next proxies HTTP, Go streams prices over WebSocket, PostgreSQL holds durable state, and Kafka delivers asynchronous events.
2. Open Markets and show five-second fictional price updates. Open Portfolio: on a fresh installation it has INR cash and no traded holdings.
3. Preview a small buy of a catalog asset, explain risk checks, submit once and inspect its final order status. Then show holdings, cash and transactions. This changes persistent demo data; rules may legitimately reject an order.
4. Show notifications. Explain the database outbox, Kafka publication and consumer persistence. Broker outages can delay notifications independently of trading results.
5. Ask AI “Summarize my portfolio holdings”, “List my simulated orders”, and “Show my reconciliation report”. Holdings explanations use Ollama. Order/reconciliation answers use deterministic read-only evidence and bypass the model. An empty order list is valid before trading.
6. Show a watchlist or FX/dividend simulation. Explain which actions are hypothetical calculations and which change demo state.

For professional discussion, describe why the services exist, what survives restart, how HTTP/WebSocket/Kafka differ, and how Flyway reproduces schema setup. Reconciliation checks internal database evidence; it does not verify a real exchange. Be candid about missing production controls and the limited accuracy of a small local model.

## Troubleshooting

| Symptom | Resolution |
| --- | --- |
| npm.ps1 blocked | Use npm.cmd/npx.cmd. For the backend script use the process-only invocation above. |
| Docker named pipe/engine missing | Start Docker Desktop, use Linux containers, enable WSL 2/virtualization and wait for `docker info` to succeed. |
| Port occupied | Inspect `Get-NetTCPConnection -LocalPort 3000,3101,5432,8080,8081,9092,11434 -ErrorAction SilentlyContinue` and identify the owning process before stopping it. Keep expected ports: several URLs are hardcoded. |
| PostgreSQL authentication failure | Match `.env` and backend/test terminal passwords. PostgreSQL initializes credentials only when the volume is first created; editing `.env` does not change an existing role's password. Have its owner update credentials without erasing data. |
| Kafka timeout/unknown topic | Wait for broker readiness, create both topics, inspect `docker compose logs --tail 100 kafka`. Kafka factories hardcode localhost:9092. |
| Flyway checksum/schema error | Inspect migration history and use a clean clone. Do not edit applied migrations, disable validation or blindly repair checksums. |
| Maven/Java error | Verify JDK 21, JAVA_HOME and network/proxy access. Wrapper pins Maven 3.10.0; distinguish missing artifacts from source errors. |
| Go toolchain error | go.mod requires 1.27.0. Check installed toolchain and download availability; do not silently lower the directive. |
| AI 502/MCP ENOENT | Run AI from its repository root after npm ci; check npx.cmd on PATH and Spring on 8080. |
| Ollama refused/model missing | Start Ollama, pull qwen2.5:0.5b, check /api/tags. First inference may take longer. AI health alone does not check the model. |
| Empty holdings/charts/orders | Fresh seed has no trades; make a small demo buy and wait for final status/history. Do not import personal database dumps. |
| Test/lint failures | Compare the validation record; do not change business logic or disable checks to claim onboarding passed. |
| Build cannot fetch Geist fonts | The existing layout downloads Geist/Geist Mono through next/font. Allow HTTPS access to fonts.googleapis.com and fonts.gstatic.com through your network/proxy. The build passed with network access during validation. |
| FX reference unavailable | Frankfurter reference FX requires external internet/service availability, independently of the local simulator. |

## Limitations and security

This is a single-user local demo, not a production brokerage, secure multi-user service, real exchange feed or financial advice. Balances and markets are simulated. The model can invent incorrect explanations: compare answers with API evidence. AI tools expose read-only evidence/calculations, not trading authority.

Docker host ports, Go and AI are configured for loopback; Spring and Next defaults may listen on other interfaces. Do not expose this setup publicly or use real customer data. Production authentication, portfolio ownership checks, TLS, hardened Kafka and secret management are not provided. `.env` is plaintext and ignored. The former Compose file contained a fixed development password; the new local variable does not remove that value from Git history. Never reuse historical demo credentials. Ignore rules protect future files, not secrets already tracked in Git.
