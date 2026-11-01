# PortfolioLab — Simulated Fintech Trading Platform

![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)
![Python 3.11](https://img.shields.io/badge/python-3.11-blue.svg)
![Node.js 22](https://img.shields.io/badge/node-22-green.svg)
![Docker](https://img.shields.io/badge/docker-20.10+-blue.svg)

## Overview
PortfolioLab is a **local‑only educational simulated trading system** that mirrors a full‑stack brokerage OMS. It models order lifecycle, portfolio accounting, risk checks and AI‑enhanced research **without touching a real exchange**.

### Who it's for
- Developers learning fintech back‑ends
- Quant trainees needing a sandbox
- Students studying finance architecture
- Product managers prototyping a brokerage

### Core Features
- **Auth & Security** – JWT (HS256), password hashing, RBAC, rate‑limiting
- **Portfolio Management** – cash, holdings, P&L, performance history (7D/1M/3M/ALL), rebalancing planner
- **Simulated Trading** – MARKET/LIMIT orders, DAY/GTC, expiration, cash/shares reservation, status lifecycle (SUBMITTED → ACCEPTED → FILLED/REJECTED/EXPIRED)
- **Real‑time Price Feed** – Go simulator (`127.0.0.1:8081`), Redis cache, `X‑Cache: HIT/MISS` headers
- **Risk & Analytics** – HHI, annualised volatility (log‑returns, √252), max draw‑down, shock‑scenario with correlation
- **FX Conversion** – asset‑price‑ratio conversion, reference‑rate list
- **Watchlists** – create, add/remove symbols per portfolio
- **Semantic Search** – Ollama embeddings (`nomic‑embed‑text`, 768‑dim) + pgvector cosine‑similarity
- **Notifications** – outbox pattern, 8 event types, Kafka production, 90‑day retention, dedup by receipt_id
- **AI‑Enhanced Research** – read‑only AI explanations via Ollama + MCP
- **Audit & Compliance** – structured audit log, correlation‑ID, Prometheus `/metrics`
- **Docker‑Compose Deployment** – one‑command stack (Postgres, Kafka, market simulator, Ollama, Redis, FastAPI, Next.js UI)

## Quick‑Start (Windows PowerShell)

```powershell
# 1️⃣ Bring up infrastructure
docker compose up -d postgres kafka market-simulator ollama redis

# 2️⃣ Verify health
docker compose logs -f   # all containers should show "healthy"

# 3️⃣ Start the Python backend
cd backend-python
.\run-backend.sh        # uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
# or: make run-backend

# 4️⃣ Start the Next.js frontend
cd frontend
npm install            # first‑time only
npm run dev            # http://localhost:3000
```

### Verify

```powershell
curl http://localhost:8000/api/health/live
# → {"status":"alive"}

curl http://localhost:8000/api/health/ready
# → {"status":"ready","checks":{"postgres":true,"redis":true,"kafka":true,"ollama":true}}

open http://localhost:8000/docs   # Swagger UI
```

### Tests & Lint

```powershell
cd backend-python
make test          # pytest -vv
make lint          # ruff check . && mypy .
```

### Stop

```powershell
docker compose down
```

## Tech Stack (summary)

| Layer | Technology |
|---|---|
| **Frontend** | Next.js 16, React 19, TypeScript 5, Tailwind 4, Recharts |
| **Backend** | FastAPI, SQLAlchemy (async), asyncpg, Pydantic v2 |
| **Security** | JWT (jose HS256), passlib (bcrypt/sha256_crypt/argon2), slowapi rate limits |
| **Database** | PostgreSQL 17, pgvector for vector similarity, 23+ Flyway migrations |
| **AI/ML** | Ollama (`nomic‑embed‑text`), MCP client/server |
| **Messaging** | aiokafka (topics: order lifecycle, execution receipt, market prices) |
| **Caching** | redis.asyncio |
| **DevOps** | Docker Compose, Makefile (`make run‑backend`, `make migrate`, `make test`, `make lint`, `make docker‑up`, `make docker‑down`), PowerShell scripts |

## Adding a New Endpoint (quick pattern)

1. Create Pydantic schema in `app/schemas/`.
2. Add ORM model if needed (or reuse existing).
3. Write route in `app/api/routes/*.py`.
4. Include router in `app/main.py`.
5. Add exception handler if required.

## License

MIT. See `LICENSE`.

*Generated 2026‑10‑27.*