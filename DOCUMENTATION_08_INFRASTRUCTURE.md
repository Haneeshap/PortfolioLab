# DOCUMENTATION 08 — Infrastructure & DevOps

## 1. Docker Compose (compose.yaml)

### Services

| Service | Image | Container | Port | Environment | Volume |
|---------|-------|-----------|------|-------------|--------|
| postgres | postgres:17 | portfoliolab-postgres | 127.0.0.1:5432:5432 | POSTGRES_DB=portfoliolab, POSTGRES_USER=portfoliolab, POSTGRES_PASSWORD=${DB_PASSWORD} | postgres_data |
| kafka | apache/kafka:3.9.1 | portfoliolab-kafka | 127.0.0.1:9092:9092 | KRaft single-node, PLAINTEXT:9092, CONTROLLER:9093, ADVERTISED:localhost:9092, AUTO_CREATE_TOPICS_ENABLE=false | kafka_data |

### Topics (created manually)
- `portfoliolab.notifications.v1` (1 partition, 1 replica)
- `portfoliolab.market-intelligence.v1` (1 partition, 1 replica)

### Health checks
- Postgres: `pg_isready -U portfoliolab -d portfoliolab` (5s interval, 5s timeout, 5 retries)
- Kafka: broker readiness via `kafka-topics.sh --list`

### Credentials
- `DB_PASSWORD` from root `.env` (copy of `.env.example`)
- Default in `application.properties`: `local_dev_password`
- Editing `.env` does NOT change an existing database role's password (PostgreSQL initializes credentials only when volume is first created)

## 2. Backend Configuration (application.properties)

```
spring.application.name=backend
spring.datasource.url=jdbc:postgresql://localhost:5432/portfoliolab
spring.datasource.username=portfoliolab
spring.datasource.password=${DB_PASSWORD:local_dev_password}
spring.jpa.hibernate.ddl-auto=validate
spring.jpa.open-in-view=false
spring.kafka.bootstrap-servers=localhost:9092
spring.kafka.consumer.group-id=portfoliolab-notifications-v1
spring.kafka.consumer.auto-offset-reset=earliest
spring.kafka.consumer.enable-auto-commit=false
spring.kafka.listener.ack-mode=record
spring.kafka.producer.key-serializer=StringSerializer
spring.kafka.producer.value-serializer=StringSerializer
spring.kafka.consumer.key-deserializer=StringDeserializer
spring.kafka.consumer.value-deserializer=StringDeserializer
```

## 3. Backend pom.xml Key Dependencies

- Spring Boot Starter WebMVC 4.1.1
- Spring Boot Starter Data JPA
- Spring Boot Starter Flyway
- Flyway Database PostgreSQL
- Spring Kafka
- PostgreSQL driver (runtime)
- Jackson Databind 2.20.0
- Spring Boot Devtools (runtime, optional)
- WebMVC Test (test scope)
- Maven Surefire: `user.timezone=UTC`
- Spring Boot Maven Plugin

## 4. Native Service Requirements

| Tool | Version | Purpose |
|------|---------|---------|
| Git for Windows | 2.x | Version control, both repositories |
| Node.js | 24.12+ | Frontend (Next 16), AI service, Developer Studio |
| JDK | 21 (Temurin) | Backend Spring Boot; JRE alone insufficient |
| Go | 1.27.0+ | Market simulator |
| Docker Desktop | WSL2, Linux containers | PostgreSQL + Kafka |
| Ollama | 0.40.4+ | LLM for AI service (qwen2.5:0.5b) |

## 5. Startup Order (Windows Quick Start)

1. `docker compose up -d postgres kafka` + create Kafka topics
2. `cd services/market-simulator && go run .` (port 8081)
3. `.\scripts\Start-Backend.ps1` (port 8080; wait for Flyway + health)
4. `cd frontend && npm.cmd run dev` (port 3000)
5. Optional: `cd portfoliolab-ai && npm.cmd start` (port 3101) + Ollama
6. Optional: `.\scripts\start-developer-studio.ps1` (port 4317)

## 6. Verification Commands

```
# Frontend
npm.cmd run lint
npm.cmd run test:m34 / m35-m37 / m38-m40 / m41-m43 / m44-m46
npx.cmd tsc --noEmit
npm.cmd run build

# Backend
.\mvnw.cmd test (UTC timezone)
.\mvnw.cmd -DskipTests package

# Go
go test -count=1 ./...
go vet ./...

# AI
npm.cmd test
npm.cmd run typecheck

# Developer Agent
npm.cmd test
npm.cmd run typecheck
```

## 7. Troubleshooting

| Symptom | Action |
|---------|--------|
| Docker named pipe missing | Start Docker Desktop; wait for Linux engine; check WSL2 v2 + desktop-linux context |
| PostgreSQL password fails | Use password that initialized the volume; editing .env does not change existing role password |
| TimeZone Asia/Calcutta failure | Use UTC: `java -Duser.timezone=UTC -jar` or updated backend config |
| Kafka connection refused | Wait for broker; create topics manually; auto-create disabled |
| Frontend API 503 | Check Spring health (8080), PostgreSQL, credentials, migrations, port 8080 |
| Port in use / Next 3001 | Identify owning process; keep Next on 3000 for Studio origin check |
| PowerShell policy blocks script | `powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\Start-Backend.ps1` |
| AI 502 / MCP ENOENT | Run AI from repo root after `npm ci`; check npx.cmd on PATH; Spring on 8080 |
| Ollama refused/model missing | Start Ollama; `ollama pull qwen2.5:0.5b`; check `http://127.0.0.1:11434/api/tags` |
| Empty holdings/charts/orders | Fresh seed has no trades; make a small demo buy and wait for final status/history |
| Build cannot fetch Geist fonts | Allow HTTPS to fonts.googleapis.com and fonts.gstatic.com |

## 8. Critical Warnings

- **Never use `docker compose down -v`** as a restart procedure (destroys data)
- **Never commit `.env` files** (plaintext secrets, git-ignored)
- **Never reuse historical demo credentials** from Git history
- **Do not expose publicly** — no auth, TLS, or production security
- **Stop services with Ctrl+C**; `docker compose stop` retains data
- Backend Kafka broker/group settings honor `spring.kafka.bootstrap-servers` and `spring.kafka.consumer.group-id`