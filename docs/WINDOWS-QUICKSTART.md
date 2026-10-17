# Windows quick start

Use PowerShell from the **PortfolioLab repository root**, not its parent or the sibling AI repository. In VS Code choose **File > Open Folder > PortfolioLab**, then open separate terminals for the services below. No workspace extensions or database dump are required.

## Install once

- Git for Windows; Node **24.12+** with npm; JDK **21** (`JAVA_HOME`); Go **1.27+**.
- Docker Desktop with the WSL2 backend and **Linux containers**. Start it and wait for the engine. `wsl --status` should show version 2; `docker context show` should show `desktop-linux`; `docker info` must include a responding server.
- Optional AI: Ollama and the separate `portfoliolab-ai` repository. GitHub access is required to clone private repositories, but no PAT is required for local Developer Studio inspection.

```powershell
git clone https://github.com/Nandantechgeek/PortfolioLab.git
Set-Location PortfolioLab
code .
Copy-Item .env.example .env
Copy-Item frontend/.env.example frontend/.env.local
# Edit .env: replace DB_PASSWORD with a unique local password, 16+ letters/digits.
# Keep existing passwords when reusing an initialized PostgreSQL volume.
Push-Location frontend
npm.cmd ci
Pop-Location
Push-Location backend
.\mvnw.cmd -DskipTests package
Pop-Location
Push-Location services/market-simulator
go mod download
Pop-Location
```

The examples are tracked; actual `.env` files are ignored. Never commit them. Spring does not read the root `.env` automatically; the backend launcher loads its password. `BACKEND_URL` is only honored by some frontend routes: retain the documented ports for the complete application.

## Start each day

1. From the root, start infrastructure and check readiness:

   ```powershell
   docker compose up -d postgres kafka
   docker compose ps
   docker compose exec -T postgres pg_isready -U portfoliolab -d portfoliolab
   docker compose exec -T kafka /opt/kafka/bin/kafka-topics.sh --bootstrap-server localhost:9092 --create --if-not-exists --topic portfoliolab.notifications.v1 --partitions 1 --replication-factor 1
   docker compose exec -T kafka /opt/kafka/bin/kafka-topics.sh --bootstrap-server localhost:9092 --create --if-not-exists --topic portfoliolab.market-intelligence.v1 --partitions 1 --replication-factor 1
   docker compose exec -T kafka /opt/kafka/bin/kafka-topics.sh --bootstrap-server localhost:9092 --list
   ```

   Retry readiness commands during startup. A running container alone does not establish readiness.

2. Simulator terminal: `Set-Location services/market-simulator`, then `go run .`.
3. Backend terminal, from the root: `.\scripts\Start-Backend.ps1`. Wait for successful Flyway migrations and `Invoke-RestMethod http://127.0.0.1:8080/api/health`.
4. Frontend terminal: `Set-Location frontend`, then `npm.cmd run dev`. Open **http://localhost:3000**.

Ports: Next 3000, Spring 8080, Go 8081, PostgreSQL 5432, Kafka 9092. Backend startup uses UTC to avoid JVM legacy timezone aliases rejected by PostgreSQL; the browser still displays local time. Backend Kafka broker/group settings now honor `spring.kafka.bootstrap-servers` and `spring.kafka.consumer.group-id`.

Use fictional data only. Preview a small simulated order, review its risks, submit it, and observe its lifecycle before expecting holdings or execution receipts in a fresh database. Inspect `/markets`, `/portfolio`, `/research`, `/portfolio/risk`, `/watchlists`, `/alerts`, `/notifications`, and `/activity`. A page shell or HTTP 503 does not establish that its data flow works.

## Optional services

**AI:** clone `https://github.com/Nandantechgeek/portfoliolab-ai.git` beside PortfolioLab. From that sibling root run `npm.cmd ci`, `npm.cmd test`, `npm.cmd run typecheck`, then `npm.cmd start`. Its current research changes require their own review and publication; a PortfolioLab commit does not publish them. Keep the AI terminal in the sibling root so MCP child paths resolve. AI listens on 3101 and launches its MCP stdio children automatically. For model-backed explanations install Ollama, run `ollama pull qwen2.5:0.5b`, start Ollama, and check `Invoke-RestMethod http://127.0.0.1:11434/api/tags`. Read-only deterministic evidence routes do not require model inference. No paid API or API key is needed.

**Developer Studio:** with Next on localhost:3000, run `.\scripts\start-developer-studio.ps1` from the root. Its one-use connection link opens `/developer`; there are no read/write passphrases. Keep the terminal open. R reconnects, G optionally reads your GitHub PAT through hidden input, Q stops the agent. Local inspection works without GitHub credentials. Git writes require explicit approval; do not test publishing by pushing real changes. See [M47-M49](M47-M49.md).

## Verify changes

```powershell
Push-Location frontend
npm.cmd run lint
node --import ./tests/register-typescript.mjs --test tests/*.test.mjs
npx.cmd tsc --noEmit
npm.cmd run build
Pop-Location
Push-Location services/developer-agent
npm.cmd test
npm.cmd run typecheck
Pop-Location
Push-Location services/market-simulator
go test -count=1 ./...
go vet ./...
Pop-Location
```

Backend integration tests must target a **new isolated database**, never existing portfolio data. See [M50-M53 verification](M50-M53.md) for the executed results and exact isolated-database commands. Frontend production serving requires a completed build: `npm.cmd run start`.

## Troubleshooting

| Symptom | Action |
| --- | --- |
| Docker named pipe missing | Start Docker Desktop; wait for Linux engine readiness. Check WSL2 and the `desktop-linux` context. If Desktop requests virtualization, an administrator change, or a reboot, complete that step before retrying; do not recreate volumes. |
| Access denied only in a sandbox | Run the same diagnostic from your normal PowerShell terminal before concluding Docker/WSL is broken. |
| PostgreSQL recovering or rejecting connections | Wait for `pg_isready` to accept connections; inspect `docker compose logs --tail 40 postgres`. Never delete its volume to fix startup. |
| Password authentication fails | Use the password that initialized the existing volume. Editing `.env` does not change an existing database role password. |
| `TimeZone: Asia/Calcutta` connection failure | Use the updated backend and Maven test configuration, which select UTC. For an older JAR, `java -Duser.timezone=UTC -jar ...` is a temporary workaround. |
| Kafka connection refused | Wait for broker startup and retry topic listing/creation. Auto topic creation is disabled. |
| Frontend API 503 | Check Spring health, PostgreSQL, credentials, migrations, and port 8080. Do not treat a rendered page as a successful backend check. |
| Port in use / Next selects 3001 | Identify the owning process; coordinate stopping it. Keep Next on 3000 for Studio's exact Origin check. |
| PowerShell policy blocks a reviewed script | Use a process-only override: `powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\Start-Backend.ps1`. |
| AI missing research tools | Check the sibling working tree/release and `npm.cmd test`; do not merge the two repositories. |

Stop terminal services with Ctrl+C. `docker compose stop` retains data. **Never use `docker compose down -v` as a restart procedure.**
