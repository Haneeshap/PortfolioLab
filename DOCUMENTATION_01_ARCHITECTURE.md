# DOCUMENTATION 01 — System Architecture & Overview

## 1. Executive Summary

**PortfolioLab** is a local, single-user, educational portfolio and simulated trading system. It never connects to a real exchange, never moves real money, and never executes actual trades. All balances, markets, orders, fills, and prices are fictional simulations designed for learning full-stack fintech engineering.

**Core value proposition:** A complete, production-style stack (Next.js + Spring Boot + PostgreSQL + Kafka + Go + MCP + Ollama) that a developer can run entirely on localhost to study REST APIs, event-driven architecture, database migrations, real-time streaming, and AI-assisted financial research — all with simulated financial data.

## 2. High-Level Data Flow

```
Browser (3000) --> Next.js API routes --> Spring Boot (8080) --> PostgreSQL (5432)
    |                   |
    |                   +--> AI (3101) --> MCP stdio child --> Spring Boot
    |                              +---> Ollama (11434)
    +--WebSocket--> Go (8081) <--HTTP-- Spring Boot
Browser --SSE--> Next.js order event proxy --> Spring committed order journal
Spring outbox --> Kafka (9092) --> notification consumer --> PostgreSQL --> UI polling
```

**Port summary:**

| Port | Service | Protocol | Bound to |
|------|---------|----------|----------|
| 3000 | Next.js frontend | HTTP | localhost:3000 |
| 8080 | Spring Boot backend | HTTP/SSE | 127.0.0.1:8080 |
| 5432 | PostgreSQL 17 | TCP | 127.0.0.1:5432 (loopback only) |
| 9092 | Apache Kafka 3.9.1 | TCP | 127.0.0.1:9092 (loopback only) |
| 8081 | Go market simulator | HTTP + WebSocket | 127.0.0.1:8081 |
| 11434 | Ollama LLM | HTTP | 127.0.0.1:11434 |
| 3101 | Ask AI service | HTTP | 127.0.0.1:3101 |
| 4317 | Developer Studio agent | HTTP | 127.0.0.1:4317 |

## 3. Component Inventory

### 3.1 Frontend (`frontend/`)
- **Framework:** Next.js 16.4.0, App Router, React 19.3.0, TypeScript 5, Tailwind CSS 4
- **Charts:** Recharts
- **Pages:** `/`, `/portfolio`, `/markets`, `/research`, `/portfolio/risk`, `/alerts`, `/notifications`, `/activity`, `/agents`, `/watchlists`, `/fx`, `/intelligence`, `/developer`
- **API proxy routes:** `api/portfolio`, `api/portfolio/simulated-orders`, `api/portfolio/orders/preview`, `api/portfolio/orders`, `api/portfolio/activity`, `api/portfolio/history`, `api/portfolio/intelligence`, `api/portfolio/risk-lab`, `api/portfolio/notifications`, `api/portfolio/watchlists`, `api/portfolio/price-alerts`, `api/market/prices`, `api/market/intelligence`, `api/fx/reference`, `api/fx/attribution`, `api/research/assets/[assetId]/history`, `api/ai/chat`, `api/ai/agents/*`
- **Client libraries:** `simulated-orders.ts`, `oms-proxy.ts`, `order-polling.ts`, `order-updates.ts`, `notification-updates.ts`, `research.ts`, `usePortfolioData.ts`

### 3.2 Backend (`backend/`)
- **Framework:** Java 21, Spring Boot 4.1.1 (WebMVC, Data JPA), Flyway, Spring Kafka
- **Build:** Maven wrapper 3.10.0, `pom.xml`
- **Database:** PostgreSQL 17, Hibernate `ddl-auto=validate`, Flyway migrations V1–V23
- **Timezone:** JVM forced to UTC at startup
- **13 domain packages:** asset, portfolio, oms, fx, dividend, market, notification, research, risk, watchlist, history, businessrules, bonus

### 3.3 Market Simulator (`services/market-simulator/`)
- **Language:** Go 1.27.0, `github.com/coder/websocket`
- **Endpoints:** `GET /health`, `GET /prices`, `GET /history`, `GET /ws/prices`
- **Assets:** 25 fictional INR assets with per-asset volatility (0.008–0.020)
- **Price model:** Random walk, updates every 5 seconds
- **History model:** Deterministic fictional fixture generation from anchor 2025-01-01

### 3.4 Ask AI Service (`portfoliolab-ai/`, sibling repo)
- **Language:** Node.js/TypeScript, tsx, MCP SDK v2.3.1 range, Zod
- **Ollama:** `qwen2.5:0.5b` on port 11434
- **Port:** 3101
- **MCP tools (read-only):** list_portfolio_holdings, simulate_dividend, simulate_bonus, evaluate_market_rules, list_simulated_orders, get_simulated_order, get_reconciliation_report

### 3.5 Developer Studio (`services/developer-agent/`)
- **Language:** Node.js/TypeScript, native node:http, child_process, crypto, fs/promises
- **Port:** 4317 (loopback only)
- **Features:** Repository overview, changed files, exact diffs, commit review/prepare, push review/execute, CI runs
- **Security:** Origin restriction, CSRF tokens, session bootstrap (2-minute lifetime), credential redaction

### 3.6 Infrastructure (`compose.yaml`)
- **PostgreSQL 17:** `postgres:17`, container `portfoliolab-postgres`, port 5432 loopback, database `portfoliolab`, volume `postgres_data`
- **Apache Kafka 3.9.1:** `apache/kafka:3.9.1`, container `portfoliolab-kafka`, port 9092 loopback, KRaft single-node, `KAFKA_AUTO_CREATE_TOPICS_ENABLE=false`, volume `kafka_data`
- **Topics:** `portfoliolab.notifications.v1`, `portfoliolab.market-intelligence.v1`
- **No application Dockerfiles:** Native services run in separate terminals

## 4. Complete End-to-End Data Flows

### 4.1 Simulated Order Lifecycle (OMS)
User submits order → POST /api/portfolio/simulated-orders → Spring Boot validates, locks portfolio, inserts order, reserves cash/shares → SimulatedExchangeWorker picks it up → gets quote from Go simulator → checks LIMIT eligibility and expiration → OrderService.settle creates Transaction → inserts simulated_exchange_executions and simulated_order_fills → updates order status → SSE pushes events → Kafka outbox publishes notification → browser polls portfolio.

### 4.2 Price Alert Flow
Go simulator updates prices every 5s → MarketIntelligenceService.observe() checks thresholds → inserts intelligence events → PriceAlertService.poll() checks alert crossings → marks TRIGGERED → PortfolioEventOutbox → Kafka → NotificationEventConsumer writes notifications → SSE invalidation → browser polls notifications.

### 4.3 Ask AI Flow
User question → POST /api/ai/chat → AI service port 3101 → Ollama port 11434 → for order questions: MCP stdio child → Spring Boot read-only evidence → response to browser.

### 4.4 Research / Risk Lab Flow
GET /api/research/assets/{id}/history → ResearchService reads cache or fetches from Go /history → inserts fictional_market_candles → calculates SMA/EMA/RSI/volatility → Recharts chart → Risk Lab: read-only repricing under shocks → HHI, volatility, drawdown metrics.

## 5. Security Boundaries & Limitations

### 5.1 What Is NOT Provided
- No authentication or authorization: single-user demo; portfolio ID 1 hardcoded
- No TLS: all HTTP is plaintext loopback
- No production secrets management: .env is plaintext and git-ignored
- No multi-user ownership checks
- No real exchange connectivity: Go simulator generates fictional prices
- No real money: all balances and markets are simulated
- No AI trading authority: Ask AI is read-only

### 5.2 Security Measures Present
- Origin restriction on Developer Studio agent (localhost:3000 only)
- CSRF tokens for Developer Studio
- Credential redaction in Git diffs and error messages
- Git hooks disabled, GPG signing disabled
- Kafka producer idempotence, acks=all, bounded timeouts
- Database row-level locking (FOR UPDATE, FOR SHARE)
- Input validation on all endpoints

### 5.3 Known Limitations
- Historical order #2 has a pre-existing reconciliation exception
- No idempotency key on order submission
- Polling ends when no active orders remain, budget exhausted, or page unmounts
- Order and portfolio GETs are separate reads, not one atomic snapshot
- No contribution/withdrawal ledger; initial deposits cannot be reconstructed
- No historical FX series; multi-currency recorded snapshots withheld
- AI model can invent incorrect explanations

## 6. Build & Test Commands

```
# Infrastructure: docker compose up -d postgres kafka
# Backend: cd backend && .\mvnw.cmd test && .\mvnw.cmd spring-boot:run
# Market Simulator: cd services/market-simulator && go run .
# Frontend: cd frontend && npm.cmd run dev
# AI Service: cd portfoliolab-ai && npm.cmd start
# Developer Studio: .\scripts\start-developer-studio.ps1
```

## 7. Verification Evidence (M50–M53, October 17, 2026)

- Frontend: 57 tests passed, zero lint errors/warnings, production build passed (39 pages)
- Backend: 144 tests passed, zero failures/errors/skips
- Go: 4 tests passed, vet passed
- AI: 73 tests passed, typecheck passed
- Developer Agent: 20 tests passed, typecheck passed
- Real-service flow checks: Passed with Next, Spring, PostgreSQL, Kafka, Go running

**Release status:** Not ready for unconditional main-branch release (main diverged from origin/main by 21 ahead, 1 behind).