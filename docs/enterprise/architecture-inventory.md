# Architecture Inventory

Service map, entry points, ports, dependencies, and database owners
established by inspecting the repository.

## 1. Services and entry points

| Service | Language/Stack | Entry point | Local port | Protocol | Notes |
| --- | --- | --- | --- | --- | --- |
| Frontend | Next.js 16 / React 19 / TS 5 / Tailwind 4 | `frontend/` (`next dev`/`build`) | `3000` | HTTP + SSE | Next.js API routes in `app/api` |
| Backend (Spring Boot) | Java 21 / Spring Boot 4.1.1 / Maven | `backend/` | `8080` | HTTP (REST) | MVC/JPA, Flyway, Spring Kafka |
| Market simulator | Go 1.27 | `services/market-simulator/` | `8081` | HTTP + WebSocket | Go price simulator, loops back to `127.0.0.1` |
| Semantic search | Python (FastAPI) | `backend-python/app` | `8000` | HTTP | SQLAlchemy async, asyncpg, pgvector, Ollama |
| Ask AI | Node/TypeScript (sibling repo) | `portfoliolab-ai/` (external) | `3101` | HTTP + MCP stdio | Out of repo; referenced as sibling |
| Developer Studio agent | Node/TypeScript | `services/developer-agent/src/server.ts` | `4317` | HTTP | Session-backed, MCP, localhost-only |
| PostgreSQL | 17 + pgvector | container | `5432` (loopback) | TCP + Postgres | `pgvector/pgvector:pg17` |
| Apache Kafka | 3.9.1 (broker+controller) | container | `9092` (loopback) | TCP | Auto-create disabled |

## 2. Compose topology

`compose.yaml` defines two named volumes (`postgres_data`, `kafka_data`)
and two services:

- `postgres` — image `pgvector/pgvector:pg17`; container
  `portfoliolab-postgres`; `POSTGRES_DB=portfoliolab`,
  `POSTGRES_USER=portfoliolab`,
  `POSTGRES_PASSWORD=${DB_PASSWORD}`; exposed only to
  `127.0.0.1:5432`; healthcheck `pg_isready`.
- `kafka` — image `apache/kafka:3.9.1`; container
  `portfoliolab-kafka`; listeners `PLAINTEXT://:9092` and
  `CONTROLLER://:9093`; advertised `PLAINTEXT://localhost:9092`;
  `KAFKA_AUTO_CREATE_TOPICS_ENABLE=false`.

All host ports bind only to `127.0.0.1` (loopback). Spring and Next.js
are the only services whose ports are unspecified in Compose and default
to their framework defaults.

## 3. Database ownership

- All PostgreSQL objects (schemas, tables, sequences, migrations, seed
  data) are owned by the Spring Boot backend team. Flyway migrations live
  under `backend/src/main/resources/db/migration` (V1-V24), including
  V9 (notification infrastructure), V16/V17/V18/V19 (simulated order
  lifecycle, executions, limit orders, reservations), and V24 (asset
  vector search).
- Semantic-search pgvector tables (`asset_search_embeddings`) are owned
  by the backend team (V24), seeded/instrumented from the Python service.
- The Python FastAPI service owns its ORM models (`backend-python/app/models`)
  but uses Alembic under `backend-python/alembic/versions` for migrations
  (see reliability-finding on migration ownership).
- The Go market simulator owns only in-memory price/funding state; no
  database. The Developer Studio agent writes no database state.

## 4. Runtime dependency graph

```
Browser :3000
  -> Next.js API routes (:3000)
      -> Spring Boot :8080 (data authority)
          -> PostgreSQL :5432
          -> Kafka :9092 (notification outbox)
          -> Go :8081 (price simulator)
          -> Ollama :11434 (embeddings)
      -> Python FastAPI :8000 (semantic search, proxied)
  -> Developer Studio agent :4317 (local dev)
  -> Ask AI :3101 (external sibling)
```

## 5. Key configuration flags

- Datasource: `jdbc:postgresql://localhost:5432/portfoliolab`, user
  `portfoliolab`, password `DB_PASSWORD` (plaintext committed).
- JPA `ddl-auto=validate`; Flyway applies V1-V24 automatically.
- Kafka: `localhost:9092`, topic `portfoliolab.notifications.v1`,
  consumer group `portfoliolab-notifications-v1`,
  `auto-offset-reset=earliest`, `enable-auto-commit=false`, ack mode
  `RECORD`.
- Search: `OllamaEmbeddingClient` hits
  `http://127.0.0.1:11434/api/embeddings` (model `nomic-embed-text`,
  768 dims); query uses `1 - (e.embedding <=> CAST(? AS vector(768)))`.
- FastAPI: `BACKEND_URL=http://127.0.0.1:8000`, `CORS_ORIGINS=*`.

## 6. Defects surfaced by the inventory

- `application.properties` ships `spring.datasource.password=${DB_PASSWORD:local_dev_password}` — a default credential exists before `.env` is read.
- `backend-python/app/core/config.py` ships `DB_PASSWORD: str = "local_dev_password"` and `CORS_ORIGINS: str = "*"`.
- A duplicate `portfolio/backend/src` source root (`portfolio/backend/...` paths) is present under `backend/src`, conflicting with the default single source-root layout.
- No `Dockerfile`, `Procfile`, or Compose overlay exists for `backend-python`; only `backend/run-backend.bat` exists.
- No least-privilege network policy beyond loopback — no explicit allow/deny rules on the Compose network.

## 6. Naming and ownership conventions observed

- Java packages mirror the component (`com.portfoliolab.backend.<domain>`).
- Java owns the database; Python is the only out-of-process compute
  consumer of the database and Ollama.
- Single service per language domain; no duplicate services.

## 7. Chain map B — Simulated-order lifecycle

1. Browser -> `POST /api/portfolio/simulated-orders` (Next.js proxy
   `oms-proxy.ts`) -> `POST http://127.0.0.1:8080/api/simulated-orders`
   (Spring `SimulatedOrderController.submit`) ->
   `SimulatedOrderService.submit` (validates, reserves, inserts
   `simulated_orders`).
2. `SimulatedOrderService` ships the order; `SimulatedExchangeWorker`
   (`fixedDelay=2500ms`) picks SUBMITTED/ACCEPTED/PARTIALLY_FILLED orders,
   validates via `OrderService`, writes `simulated_exchange_executions` and
   `simulated_order_fills`, updates status to FILLED/PARTIALLY_FILLED.
3. Order lifecycle events are recorded into the notification outbox
   (`PortfolioEventOutbox.record`), polled by `NotificationOutboxPublisher`,
   sent to Kafka topic `portfoliolab.notifications.v1`, consumed by
   `NotificationEventConsumer`, which upserts rows into `notifications` /
   `notification_receipts`.
4. Browser subscribes to `GET /api/portfolio/simulated-orders/events`
   (SSE passthrough forwarding Spring's
   `GET /api/portfolios/1/simulated-orders/events`), with a 5-second
   polling fallback (`startOrderPolling`) when the stream disconnects.

## 8. Chain map C — Semantic search

1. Browser -> `GET /api/search/semantic` (Next.js) ->
   `GET http://127.0.0.1:8080/api/search/semantic?q=...` (Spring).
2. Spring `AssetSearchService.semanticSearch` embeds the query via
   `OllamaEmbeddingClient` -> `POST http://127.0.0.1:11434/api/embeddings`
   (`nomic-embed-text`), then calls `AssetSearchRepository.searchNearest`
   (pgvector `<=>` distance query).
3. The FastAPI `search.py` downstreams `GET http://127.0.0.1:8080/api/search/semantic`
   (a passthrough, not an independent embedder) to the same Spring endpoint.
