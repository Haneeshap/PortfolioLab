# PortfolioLab System Architecture

```mermaid
%%{init: {'theme': 'base', 'themeVariables': { 'primaryColor': '#f8f9fa', 'primaryBorderColor': '#6c757d', 'fontFamily': 'sans-serif' }}}%>
flowchart TB
    subgraph Frontend["🌐 Next.js Frontend (React + TypeScript)"]
        UI[User Interface] -->|HTTP / WS| API_Gateway[FastAPI Gateway]
    end

    subgraph Backend["🐍 FastAPI Backend (Python)"]
        dir[Docker Entrypoint] -->|Lifespan| DB[(PostgreSQL 17 + pgvector)]
        dir -->|Health Checks| Kafka[(Apache Kafka 3.9.1)]
        dir -->|Embedding Calls| Ollama[(Ollama LLM Service)]
        dir -->|Price Proxy| MarketSim[Go Market Simulator (127.0.0.1:8081)]
        dir -->|Cache| Redis[(Redis 7)]
        dir -->|Metrics| Prometheus[Prometheus]
    end

    subgraph Data["💾 Data Stores"]
        DB
        Kafka
        Redis
    end

    subgraph AI["🤖 AI Services"]
        Ollama
    end

    %% Connections
    API_Gateway <-->|HTTP Requests| UI
    API_Gateway <-->|SQL/Async| DB
    API_Gateway <-->|Produce/Consume| Kafka
    API_Gateway <-->|Embedding Request/Response| Ollama
    API_Gateway <-->|Get/Set Prices| MarketSim
    API_Gateway <-->|Cache Read/Write| Redis
    API_Gateway <-->|Export Metrics| Prometheus

    style Frontend fill:#e3f2fd,stroke:#1565c0,stroke-width:2px
    style Backend fill:#e8f5e9,stroke:#2e7d32,stroke-width:2px
    style Data fill:#fff3e0,stroke:#ef6c00,stroke-width:2px
    style AI fill:#f1f8e9,stroke:#33691e,stroke-width:2px
```

## Architecture Explanation

1. **Frontend (Next.js App Router)**
   - React 19 + TypeScript + Tailwind 4.
   - Pages: dashboard, trade‑form, watchlist, risk‑lab, AI research terminal.
   - Communicates with the FastAPI gateway via REST (`/api/...`) and optional WebSocket for real‑time price updates.

2. **FastAPI Backend**
   - Single process started via `docker compose up` or `uvicorn app.main:app`.
   - **Lifespan** on startup performs health checks: PostgreSQL, Kafka, Ollama, Go simulator.
   - Middleware stack (CORS, correlation‑ID, X‑Cache, Prometheus instrumentation).
   - JWT authentication (`security.py`) protects all `/api/*` routes.
   - Async SQLAlchemy engine talks to PostgreSQL (asyncpg, pgvector for vector similarity).

3. **PostgreSQL (with pgvector)**
   - Stores all domain data: users, portfolios, assets, holdings, orders, audit logs, etc.
   - `pgvector` extension powers the semantic‑search endpoint (`/api/search/semantic`).

4. **Apache Kafka**
   - Three core topics:
     - `oms.order.lifecycle.events` – order placed/fille/rejected.
     - `oms.execution.receipt` – execution details after fill.
     - `oms.market.prices` – price updates published by the Go simulator.
   - Used by notification service, risk‑lab, and any downstream consumers.

5. **Ollama (local LLM)**
   - Provides embeddings (`nomic‑embed‑text`, 768‑dim) for semantic search.
   - Also serves as a chat model (`qwen2.5:0.5b`) for AI‑generated explanations in the research terminal.

6. **Go Market Simulator**
   - Binary listening on `127.0.0.1:8081/prices`.
   - Returns synthetic price ticks (OHLCV) that drive order‑fill logic.
   - The FastAPI `market_service.py` proxies requests, adds `X‑Cache` headers, and falls back to Redis cache.

7. **Redis**
   - Cache for latest market prices (`portfoliolab:prices:{symbol}`).
   - Quick health‑check look‑ups (`exists("health_check")`).
   - Outbox‑pattern deduplication receipt IDs.

8. **Prometheus + `/metrics`**
   - Automatic instrumentation via `prometheus_fastapi_instrumentator`.
   - Exposed for observability dashboards (Grafana, etc.).

## Deployment Diagram (textual)

```
+----------------------+       +----------------------+
|   Developer Workstation   |
|  (Docker Desktop, Git)  |
+----------+------------+-----------+-----------+
           |                         |
           |  docker compose up -d   |
           v                         v
+----------------------+   +----------------------+
|  PostgreSQL 17       |   |  Kafka 3.9.1         |
|  + pgvector         |   |  Topics: order, price|
+----------+-----------+ +--------+-----------+
           |                         |
           |  docker compose up -d   |
           v                         v
+----------------------+   +----------------------+
|  Go Market Simulator|   |  Ollama LLM Service |
|  (127.0.0.1:8081)   |   |  embeddings, chat   |
+----------+-----------+ +--------+-----------+
           |                         |
           |  docker compose up -d   |
           v                         v
+----------------------+   +----------------------+
|  Redis 7 (cache)     |   |  FastAPI Backend     |
|  (price cache)       |   |  (uvicorn)           |
+----------------------+   +----------+-----------+
                                   |
                                   v
                               +-------------+
                               |  Next.js UI |
                               | (React/Tail) |
                               +-------------+
```

**Key Take‑aways**

- All state lives in **PostgreSQL**; cache & streaming via **Redis** and **Kafka**.
- AI embeddings are generated **locally** via Ollama; no external API keys required for the demo.
- The Go simulator decouples price generation from the Python business logic, enabling realistic “real‑time” behaviour without an external feed.
- The whole stack is **docker‑compose‑driven**, making onboarding a single command (`docker compose up --build`).

---
*Diagram and architecture generated from code‑base inspection on 2026‑10‑27.*