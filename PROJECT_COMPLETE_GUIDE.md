# PortfolioLab — Complete Project Guide (Single Document)

> Everything about the project in one place, written so you can answer **any** question your employer asks.
> Consolidated from the full source tree, `README.md`, and the 10-part documentation series.

---

## TABLE OF CONTENTS

1. What Is PortfolioLab (Elevator Pitch)
2. Key Facts at a Glance
3. System Architecture & Data Flow
4. The Five Services (Component Inventory)
5. Technology Stack
6. Backend Deep Dive (Spring Boot / Java)
7. Frontend Deep Dive (Next.js / React)
8. Database Deep Dive (PostgreSQL / Flyway)
9. Market Simulator Deep Dive (Go)
10. AI Service Deep Dive (Node/TypeScript, MCP, Ollama)
11. Developer Studio Deep Dive
12. Infrastructure & DevOps
13. Complete API Reference
14. Security Boundaries & Limitations
15. Milestones & Release History (M31–M53)
16. Known Issues & Technical Debt
17. How to Run It (Windows Quick Start)
18. Verification & Test Evidence
19. FAQ — Anticipated Employer Questions (with answers)

---

## 1. WHAT IS PORTFOLIOLAB (ELEVATOR PITCH)

**PortfolioLab** is a local, single-user, **educational portfolio and simulated-trading system**. It is a full production-style fintech stack that runs entirely on a developer's machine (localhost). It **never connects to a real exchange, never moves real money, and never executes real trades.** Every balance, market price, order, fill, and price chart is a fictional simulation built for learning full-stack engineering.

**Why it exists:** to demonstrate and study, in one cohesive system:
- REST API design and event-driven architecture
- Database schema design with versioned migrations
- Real-time streaming (WebSocket + Server-Sent Events)
- Message queues (Kafka) and the transactional-outbox pattern
- An Order Management System (OMS) with reservations, limits, and reconciliation
- AI-assisted financial research using a local LLM and the Model Context Protocol (MCP)

**The core value proposition:** A complete, production-style stack — **Next.js + Spring Boot + PostgreSQL + Kafka + Go + MCP + Ollama** — that a developer can run on localhost to study all of these concepts with realistic but entirely fictional financial data.

**One-sentence summary for your employer:**
> "PortfolioLab is a from-scratch, microservice-style simulated trading platform I built locally to demonstrate end-to-end full-stack and fintech engineering: a React/Next.js dashboard talking to a Java Spring Boot API backed by PostgreSQL, with a Go price simulator, Kafka event notifications, and a local LLM 'Ask AI' copilot — all simulated, no real money or exchange."

---

## 2. KEY FACTS AT A GLANCE

| Attribute | Value |
|-----------|-------|
| Type | Local, single-user, educational simulated-trading system |
| Real money / real exchange? | **No** — fully simulated, loopback-only |
| Services | 5 runtimes + 1 external LLM (Ollama) + Docker (Postgres + Kafka) |
| Ports | 3000 (Next), 8080 (Spring), 5432 (Postgres), 9092 (Kafka), 8081 (Go), 11434 (Ollama), 3101 (AI), 4317 (Dev Studio) |
| Database | PostgreSQL 17, Flyway migrations V1–V23 |
| Messaging | Apache Kafka 3.9.1 (KRaft, single node) |
| LLM | Ollama `qwen2.5:0.5b` (fully local, no API key) |
| Frontend pages | 13 App Router pages, 39 built pages |
| Backend domain packages | 13 |
| Fictional assets | 25 (INR) |
| Portfolio | Demo Portfolio ID 1, initial cash ₹100,000 |
| Latest verification | Oct 17, 2026 — all test suites green |
| Test totals | Frontend 57, Backend 144, Go 4, AI 73, Dev Agent 20 = **298 tests passing** |
| Release status | Not ready for unconditional main-branch release (main is 21 ahead / 1 behind origin) |

---

## 3. SYSTEM ARCHITECTURE & DATA FLOW

### High-level data flow

```text
Browser :3000 --> Next.js API routes --> Spring Boot :8080 --> PostgreSQL :5432
    |                   |
    |                   +--> AI :3101 --> MCP stdio child --> Spring Boot
    |                              +---> Ollama :11434
    +--WebSocket--> Go :8081 <--HTTP-- Spring Boot
Browser --SSE--> Next.js order event proxy --> Spring committed order journal
Spring outbox --> Kafka :9092 --> notification consumer --> PostgreSQL --> UI polling
```

### Port map

| Port | Service | Protocol | Bound to |
|------|---------|----------|----------|
| 3000 | Next.js frontend | HTTP | localhost:3000 |
| 8080 | Spring Boot backend | HTTP / SSE | 127.0.0.1:8080 |
| 5432 | PostgreSQL 17 | TCP | 127.0.0.1:5432 (loopback only) |
| 9092 | Apache Kafka 3.9.1 | TCP | 127.0.0.1:9092 (loopback only) |
| 8081 | Go market simulator | HTTP + WebSocket | 127.0.0.1:8081 |
| 11434 | Ollama LLM | HTTP | 127.0.0.1:11434 |
| 3101 | Ask AI service | HTTP | 127.0.0.1:3101 |
| 4317 | Developer Studio agent | HTTP | 127.0.0.1:4317 |

### Core end-to-end flows

**Simulated Order Lifecycle (OMS):**
User submits order → `POST /api/portfolio/simulated-orders` → Spring validates, locks the portfolio row, inserts the order, reserves cash/shares → `SimulatedExchangeWorker` picks it up → fetches a quote from the Go simulator → checks LIMIT eligibility and expiration → `OrderService.settle` creates a `Transaction` → inserts `simulated_exchange_executions` and `simulated_order_fills` → updates order status → SSE pushes events → Kafka outbox publishes a notification → browser polls the portfolio.

**Price Alert Flow:**
Go simulator updates prices every 5s → `MarketIntelligenceService.observe()` checks thresholds → inserts intelligence events → `PriceAlertService.poll()` checks alert crossings → marks `TRIGGERED` → PortfolioEventOutbox → Kafka → `NotificationEventConsumer` writes notifications → SSE invalidation → browser polls notifications.

**Ask AI Flow:**
User question → `POST /api/ai/chat` (Next) → AI service :3101 → Ollama :11434 → (for order questions) MCP stdio child → Spring Boot read-only evidence → response back to browser.

**Research / Risk Lab Flow:**
`GET /api/research/assets/{id}/history` → ResearchService reads its cache or fetches from Go `/history` → inserts `fictional_market_candles` → computes SMA/EMA/RSI/volatility → renders a Recharts chart. Risk Lab performs read-only repricing under shocks and reports HHI, volatility, and drawdown metrics.

### Architectural patterns used (good talking points)

- **Layered MVC** on the backend (Controller → Service → Repository → Entity).
- **Transactional outbox** for reliable event publication to Kafka (no dual-write problem).
- **CQRS-lite / read-only evidence** for the AI layer — the LLM never mutates state.
- **Model Context Protocol (MCP)** to give the LLM a fixed, auditable, read-only tool surface.
- **Optimistic + pessimistic locking** — `FOR UPDATE` / `FOR SHARE` row locks around money movement.
- **SSE with polling fallback** for resilient real-time UI updates.
- **Versioned DB migrations** (Flyway) with Hibernate schema validation (no auto-DDL).
- **Deterministic simulation** — the price/history generator is seeded so results are reproducible.

---

## 4. THE FIVE SERVICES (COMPONENT INVENTORY)

| # | Service | Location | Stack | Port | Responsibility |
|---|---------|----------|-------|------|----------------|
| 1 | Frontend | `frontend/` | Next.js 16.4.0, React 19.3.0, TS 5, Tailwind 4, Recharts | 3000 | Dashboard UI + API proxy routes |
| 2 | Backend | `backend/` | Java 21, Spring Boot 4.1.1, JPA, Flyway, Kafka | 8080 | Core domain, OMS, REST API, SSE |
| 3 | Market Simulator | `services/market-simulator/` | Go 1.27.0, coder/websocket | 8081 | Live prices + fictional OHLCV history |
| 4 | AI Service (Ask AI) | sibling `portfoliolab-ai/` | Node/TypeScript, MCP SDK, Zod, Ollama | 3101 | Chat, agents, MCP read-only tools |
| 5 | Developer Studio | `services/developer-agent/` | Node/TypeScript (stdlib only) | 4317 | Local Git/CI change explorer |
| + | Infrastructure | `compose.yaml` | PostgreSQL 17, Kafka 3.9.1 | 5432 / 9092 | Persistence + messaging |

> Note: The AI service lives in a **separate sibling repository** (`c:\Users\hanee\projects2026\portfoliolab-ai`), not inside the main `PortfolioLab` folder.

---

## 5. TECHNOLOGY STACK

| Source | Stack declared in repository |
|--------|------------------------------|
| `frontend/` | Next.js 16.4.0 App Router, React 19.3.0, TypeScript 5, Tailwind 4, Recharts; npm lockfile |
| `backend/` | Java 21, Spring Boot 4.1.1 (WebMVC, Data JPA), Flyway, PostgreSQL driver, Spring Kafka; Maven wrapper 3.10.0 |
| `services/market-simulator/` | Go 1.27.0, `github.com/coder/websocket`; go.mod/go.sum |
| `compose.yaml` | PostgreSQL 17, Apache Kafka 3.9.1 (KRaft), named volumes, loopback host ports |
| `portfoliolab-ai/` (sibling) | Node/TypeScript, tsx, MCP client/server SDK 2.3.1 range, Zod; Ollama `qwen2.5:0.5b` |

### Native toolchain required to run it

| Tool | Version | Purpose |
|------|---------|---------|
| Git for Windows | 2.x | Version control (both repositories) |
| Node.js | 24.12+ | Frontend, AI service, Developer Studio |
| JDK (Temurin) | 21 | Backend Spring Boot (a JRE alone is not enough) |
| Go | 1.27.0+ | Market simulator |
| Docker Desktop | WSL2, Linux containers | PostgreSQL + Kafka |
| Ollama | 0.40.4+ | Local LLM for Ask AI (`qwen2.5:0.5b`) |

---

## 6. BACKEND DEEP DIVE (Spring Boot / Java 21)

### Overview
- **Entry point:** `BackendApplication.java` — forces the JVM to UTC, runs SpringApplication.
- **Health:** `GET /api/health` → `{"status":"UP","application":"PortfolioLab"}`.
- **DB validation:** Hibernate `ddl-auto=validate` — the schema must exactly match Flyway migrations; no auto-creation.
- **Open-in-view:** disabled (`spring.jpa.open-in-view=false`) — no lazy-loading during rendering.
- **Config:** datasource `jdbc:postgresql://localhost:5432/portfoliolab`, user `portfoliolab`, password from `DB_PASSWORD` env (default `local_dev_password`), Kafka bootstrap `localhost:9092`, consumer group `portfoliolab-notifications-v1`, record ack mode, auto-commit disabled.

### 13 domain packages

| Package | Responsibility | Key classes |
|---------|---------------|-------------|
| `asset` | Asset catalog CRUD | Asset, AssetRepository, AssetService, AssetController, AssetResponse |
| `portfolio` | Portfolio, holdings, transactions, order DTOs, performance accounting, intelligence | Portfolio, PortfolioRepository, PortfolioService, PortfolioController, PortfolioResponse, HoldingResponse, OrderRequest, OrderResponse, Transaction, TransactionRepository, TransactionResponse, PerformanceAccounting, PortfolioIntelligenceService, PortfolioIntelligenceController |
| `oms` | Order Management System | SimulatedOrderService, SimulatedOrderController, OrderReservations, OrderConditions, OrderEventStream, SimulatedExchangeWorker, ReconciliationService |
| `fx` | FX conversion, attribution, reference rates | FxController, FxConversionService, FxRate, FxRateRepository, FrankfurterRateController/Service, FxAttributionController/Service |
| `dividend` | Dividend simulation, credit, scheduling | DividendController, DividendSimulationService, DividendCreditService/Controller, ScheduledDividendService/Scheduler/Controller, DividendSchedulingConfig |
| `market` | Market prices, intelligence, price alerts | MarketController/Service, MarketPrice, MarketIntelligenceController/Service, PriceAlertController/Service |
| `notification` | Notifications, outbox, preferences, retention, activity, pre-trade risk | NotificationController, NotificationEventConsumer, NotificationKafkaConfig, NotificationOutbox/Publisher, NotificationPreferences, NotificationRetention, ActivityController, PortfolioEventOutbox, PreTradeRiskService/Controller |
| `research` | Fictional history, indicators, risk lab | ResearchController/Service, ResearchMath, ResearchHistoryStore, RiskLabController/Service |
| `risk` | Pre-trade risk policies (in notification package) | PreTradeRiskService, PreTradeRiskController |
| `watchlist` | Watchlists and items | WatchlistController |
| `history` | Portfolio snapshots/history | PortfolioHistoryController, PortfolioHistoryRecorder |
| `businessrules` | Market rule evaluation | MarketRulesController, MarketRulesRequest, MarketRulesService |
| `bonus` | Bonus share simulations | BonusController, BonusSimulationService/Request/Response |

### The OMS (the most important subsystem to understand)

Order status lifecycle: `SUBMITTED → ACCEPTED → PARTIALLY_FILLED → FILLED / REJECTED / CANCELLED / EXPIRED`.

- **Order types:** `MARKET`, `LIMIT`. **Time-in-force:** `DAY` (expires midnight Asia/Kolkata), `GTC`.
- **Reservations (V19):** a BUY reserves `qty × ceil4(limit × FX × 1.05)` cash (a 5% buffer); a SELL reserves shares. This prevents over-committing funds before a fill.
- **`SimulatedExchangeWorker`:** background worker that drains pending orders, fetches a quote from the Go simulator, checks LIMIT eligibility/expiration, and settles fills. Defers on transient errors; rejects/cancels on 4xx.
- **`ReconciliationService`:** a SQL-CTE consistency checker at `/api/portfolios/{id}/reconciliation`. Detects: `MISSING_SETTLEMENT_LINK`, `EXECUTION_TRANSACTION_MISMATCH`, `RECEIPT_FILL_COUNT_MISMATCH`, `RECEIPT_FILL_QUANTITY_MISMATCH`, `ORDER_FILLED_QUANTITY_MISMATCH`, `INVALID_FILLED_STATUS`, `INVALID_PARTIAL_STATUS`, `INVALID_UNFILLED_STATUS`, `INVALID_CANCELLED_STATUS`, `TERMINAL_RESERVATION`, `LEGACY_UNRESERVED_ORDER`, `RESERVATION_QUANTITY_MISMATCH`, `OVER_RESERVED_CASH`, `OVER_RESERVED_SHARES`.
- **Concurrency safety:** `PortfolioRepository.findByIdForUpdate` uses `@Lock(PESSIMISTIC_WRITE)` (`FOR UPDATE`) so two orders can never spend the same rupee.

### Portfolio & accounting
- `Portfolio` entity: `cash_balance` is non-null and validated `>= 0`.
- `Transaction` records `execution_fx_rate` and `portfolio_amount` (value in the portfolio's currency).
- `PerformanceAccounting` utility: `money()` (4 dp HALF_UP), `pct()`, `replay()` (weighted-average cost-basis replay of fills), `contribution()` (period contribution formula).
- `PortfolioIntelligenceService`: `performance(id, period)` returns series, return %, per-asset attribution, totals, warnings; `plan(id, targets)` is a **read-only** rebalancing planner (whole shares only, 5% cash buffer, per-ticket risk-policy check).

---

## 7. FRONTEND DEEP DIVE (Next.js 16 / React 19 / TypeScript)

### Overview
- **Build/dev:** `npm.cmd ci`, `npm.cmd run dev` (port 3000), `npm.cmd run build`, `npx.cmd tsc --noEmit`, `npm.cmd run lint`.
- **Config:** `frontend/.env.local` (copy of `.env.example`); `BACKEND_URL` defaults to `http://localhost:8080`.
- **All API responses use `Cache-Control: no-store`** (always fresh financial data).
- **Demo portfolio ID 1 is hardcoded** throughout (single-user; no ownership checks).

### Page routes (13)

| Route | Purpose |
|-------|---------|
| `/` | Landing/home |
| `/portfolio` | Main portfolio: intelligence + holdings |
| `/portfolio/risk` | Risk Lab |
| `/markets` | Asset catalog |
| `/research?assetId=` | Research terminal (fictional history + replay) |
| `/alerts?symbol=` | Price alerts |
| `/notifications` | Notification history + preferences |
| `/activity` | Activity timeline + history |
| `/agents` | Dividend / Bonus / Business-rules agents |
| `/watchlists` | Watchlists |
| `/fx` | FX conversion + attribution |
| `/intelligence` | Market intelligence feed |
| `/developer` | Developer Studio |

### API proxy routes (Next.js → Spring Boot)

The browser never calls Spring Boot directly; Next.js API routes act as a proxy. Key routes: `api/portfolio` (aggregated portfolio), `api/portfolio/simulated-orders` (+ `[orderId]`, `/cancel`, `/availability`, `/events` SSE), `api/portfolio/orders/preview`, `api/portfolio/orders`, `api/portfolio/activity`, `api/portfolio/history`, `api/portfolio/intelligence` (performance + rebalance), `api/portfolio/risk-lab`, `api/portfolio/notifications` (+ `/preferences`, `/unread-count`), `api/portfolio/watchlists`, `api/portfolio/price-alerts`, `api/market/prices`, `api/market/intelligence`, `api/fx/reference`, `api/fx/attribution`, `api/research/assets/[assetId]/history`, `api/ai/chat`, `api/ai/agents/*`.

### Client libraries
- `simulated-orders.ts`, `oms-proxy.ts` (forwards to Spring, maps 404/409/5xx to friendly errors), `order-polling.ts` (serial bounded loop: no overlap, max 100 requests, max 3 errors, 3s interval), `order-updates.ts` (SSE EventSource; falls back to polling on error), `notification-updates.ts` (SSE, debounced 100ms), `research.ts`, `usePortfolioData.ts`.

### Key components
- `TradeForm.tsx` / `RecentOrders.tsx` — order submission and live order list.
- `PortfolioOverview.tsx` / `HoldingsTable.tsx` — valuation and holdings.
- `ResearchTerminal.tsx` — OHLCV charts with replay.
- `DividendAgent.tsx` / `BonusAgent.tsx` / `BusinessRulesAgent.tsx` — read-only simulation forms with disclaimers.
- `DeveloperStudio.tsx` — Git/CI explorer at `/developer`.
- `AppShell.tsx` — theme, navigation, layout shell.

### Frontend test suites
`tests/m34.test.mjs` (route contracts), `m35-m37` (limits/reservations/lifecycle), `m38-m40` (research/risk/AI), `m41-m43` (notifications/activity), `m44-m46` (performance/attribution/rebalancing), `m47-m49` (Developer Studio). **Verification:** lint zero issues, `tsc --noEmit` clean, build produces 39 pages, 57 tests passing.

---

## 8. DATABASE DEEP DIVE (PostgreSQL 17 / Flyway V1–V23)

### Overview
- Migrations run automatically on backend startup; Hibernate validates the schema (no manual table creation, no DB dump needed).
- Session timezone `Etc/UTC`; backend forces JVM UTC.
- Seed: 5 assets (V2), demo portfolio ID 1 with ₹100,000 (V4), FX USD→INR 85.0 and EUR→INR 92.0 (V6).

### Migration summary

| Version | Key change |
|---------|-----------|
| V1 | Create `assets` |
| V2 | Seed 5 demo assets (DEMO, NOVA, GREEN, ORBIT, ALPHA) |
| V3 | Create `portfolios`, `holdings`, `transactions` |
| V4 | Seed demo portfolio (ID 1, 100000 INR) |
| V5 | `portfolio_snapshots` |
| V6 | `fx_rates` (USD→INR 85, EUR→INR 92) |
| V7 | Transaction FX (`execution_fx_rate`, `portfolio_amount`) |
| V8 | Holding `historical_cost_portfolio` + backfill |
| V9 | `notification_outbox`, `notifications` |
| V10 | `simulated_dividend_payments`, `portfolio_risk_insights` |
| V11 | Scheduled dividends tables |
| V12 | `market_price_alerts` |
| V13 | `watchlists`, `watchlist_items` + 20 sector assets |
| V14 | `market_price_samples`, `market_intelligence_events`, `market_intelligence_outbox` |
| V15 | `pre_trade_risk_policies` (max_order_value 50000, max_position_pct 100) |
| V16 | `simulated_orders`, `simulated_order_fills` |
| V17 | `simulated_exchange_executions` (receipts) |
| V18 | Limit orders (`order_type`, `limit_price`, `time_in_force`, `expires_at`, EXPIRED) |
| V19 | Reservations (`reservation_managed`, `reserved_cash`, `reserved_shares`, `cash_per_share`) |
| V20 | `simulated_order_events` + trigger |
| V21 | `fictional_market_candles` (OHLCV, source `fictional-history-v1`) |
| V22 | `notification_preferences`, `notification_receipts`, order notification trigger |
| V23 | Verified portfolio observation (referenced; migration file not present in repo) |

### Seeded assets (25 fictional INR assets)
V2 seeds DEMO 125.50, NOVA 842.75, GREEN 315.25, ORBIT 1560.00, ALPHA 98.40. V13 adds 20 sector-classified assets across Technology, Finance, Energy, Industrial, Healthcare, Consumer. The Go simulator holds the full 25-asset price table (e.g., NEXUS, QUANT, CYBER, CLOUD, FINIX, VAULT, CREDO, PAYGO, TRUST, SOLAR, VOLT, HYDRO, STEEL, METRO, MEDIX, BIOVA, CAREX, FRESH, URBAN, AURORA).

### Data-integrity rules (important talking points)
- Receipts are **evidence**, not an extra cash flow.
- Pending orders, cancellations, and reservations do **not** change holdings.
- Trade cash uses `portfolio_amount` at the execution FX rate; buys decrease cash, sells increase it.
- **Immediate settlement** on fill — no delayed receivable/payable model.
- Manual vs scheduled dividends use separate payment ledgers; `credited_at` drives income timing.
- Research OHLCV (`fictional-history-v1`) is excluded from portfolio accounting.
- **No fees** modeled; **no contribution/withdrawal ledger** (initial deposits can't be reconstructed).

---

## 9. MARKET SIMULATOR DEEP DIVE (Go)

### Overview
- **Location:** `services/market-simulator/` · Go 1.27.0 · `github.com/coder/websocket v1.8.15` · `127.0.0.1:8081`.
- **Purpose:** generate live simulated prices for 25 fictional INR assets + deterministic historical OHLCV; push prices over WebSocket every 5 seconds.

### Source files
`main.go` (HTTP server, routes, WS handler, ticker), `simulator.go` (price model + volatility), `history.go` (fictional OHLCV fixtures), `go.mod`/`go.sum`.

### Endpoints
`GET /health`, `GET /prices`, `GET /ws/prices` (WebSocket), `GET /history?symbol=&from=&to=`.

### Price model
Every 5s a background goroutine applies a random walk per asset:
`change := (rand.Float64() - 0.5) * 2 * volatility[symbol]; price = price * (1 + change)`.
Volatility ranges 0.008–0.020 (max ~±2% per step). A `sync.RWMutex` protects the shared price map. Prices reset on restart (no persistence).

### History model (deterministic)
- Anchor 2025-01-01 UTC; seed derived from an FNV-1a hash of the symbol → same symbol+range always yields identical candles.
- Constraints: `from >= 2025-01-01`, `to > from`, range ≤ 366 days, `to <= today`.
- Each day: `open = previous close`; `change = 0.0003 + 0.008*sin(i*0.7) + (rng-0.5)*0.025`; `high/low` around open/close; `volume` 10K–100K. Never touches the live-price map.

### Integration
Spring `MarketService` calls `/prices` via RestClient (wraps failures in `MarketServiceUnavailableException` → HTTP 503). `ResearchHistoryStore` calls `/history` (3s connect / 5s read timeout), validates `source="fictional-history-v1"`, interval, candle count and OHLC invariants, then inserts into `fictional_market_candles` (`ON CONFLICT DO NOTHING`).

### Limitations
No admin price override, no durable history (regenerated each time), 25 fixed assets only, live samples pruned after 24h, prices reset on restart.

---

## 10. AI SERVICE DEEP DIVE (portfoliolab-ai — sibling repo)

### Overview
- **Location:** `c:\Users\hanee\projects2026\portfoliolab-ai\` · Node/TypeScript (tsx) · MCP client+server SDK 2.3.1 range · Zod v4 · Ollama `qwen2.5:0.5b` · port `3101`.
- **Purpose:** "Ask AI" — educational explanations, holdings analysis, and read-only order/reconciliation evidence via MCP. **Strictly read-only: no trade placement, no portfolio mutation.**

### Source files
`src/server.ts` (HTTP + Ollama chat), `src/mcp-client.ts` (MCP stdio client), `src/mcp-server.ts` (MCP stdio server, 7 read-only tools), `src/order-intelligence.ts` (Zod schemas, intent router, evidence formatting), `src/portfolio.ts` (holdings fetch).

### System prompt
> "You are PortfolioLab AI, an educational assistant for a simulated investment portfolio. Explain concepts clearly. Never invent portfolio balances, holdings, or prices. Do not claim to have accessed portfolio data."

### Endpoints
`POST /api/portfolio/chat`, `POST /api/agents/business-rules/evaluate`, `POST /api/agents/bonus/simulate`, `POST /api/agents/dividend/simulate`, `GET /api/portfolio/:id/holdings`.

### MCP tools (7, all `readOnlyHint: true`, `destructiveHint: false`)
`list_portfolio_holdings`, `simulate_dividend`, `simulate_bonus`, `evaluate_market_rules`, `list_simulated_orders`, `get_simulated_order`, `get_reconciliation_report`. Errors return `isError: true` with sanitized messages (no stack traces).

### Deterministic intent router (key design point)
Order/reconciliation questions bypass the LLM and use a deterministic path: the router matches "reconciliation/reconcile/consistency", an order-ID number, or "recent/latest/last order", then calls the exact read-only tool. **Evidence sanitization** (`publicReason`) withholds detailed failure reasons — only a safe allowlist is shown; everything else becomes "A failure reason was recorded, but its details are deliberately withheld in Ask AI."

### Security & limitations
Read-only only; portfolio ID 1 is the demo scope; the Ollama model can still invent incorrect explanations (compare answers with API evidence); MCP child spawned via `npx.cmd` (must be on PATH); health check does not verify model availability.

---

## 11. DEVELOPER STUDIO DEEP DIVE

### Overview
- **Location:** `services/developer-agent/` + `frontend/src/app/developer/` · route `/developer` · agent on `127.0.0.1:4317`.
- **Language:** Node/TypeScript using only the standard library (`node:http`, `child_process`, `crypto`, `fs/promises`) — **no agent npm dependencies**.
- **Launcher:** `.\scripts\start-developer-studio.ps1`.
- **Purpose:** a local, developer-only change explorer — exact staged/worktree diffs, approved staging/commits/pushes, and real GitHub Actions results.

### Architecture
Browser `/developer` → agent :4317 → local Git repositories (read-only roots), GitHub (optional fine-grained PAT over HTTPS), and local Ollama (optional analysis).

### Security model (strong talking point)
- **Origin restriction:** the agent only accepts requests from `http://localhost:3000` (note: not `127.0.0.1:3000` — different cookie site).
- CSRF token per session.
- **Session bootstrap:** a 2-minute, one-time 256-bit credential (SHA-256 digest, single-use); sessions last 30 minutes; rate-limited to 10 connection attempts/minute.
- GitHub PAT entered via hidden terminal prompt (never in the browser), validated as `github_pat_*`, injected via `GIT_ASKPASS` (never in command arguments).
- Git hooks disabled (`core.hooksPath=/dev/null`), GPG signing disabled, **no force push / pull / rebase**.
- `security.ts`: `equalSecret` (timing-safe SHA-256 comparison), `redact` (private keys, PATs, AWS keys, URL/key=value secrets), `sensitivePath` (.env, .npmrc, id_rsa, .pem, .key, .p12, .pfx), `flags` and `group` (categorizes files; flags credential/DB/auth/CI/lockfiles).

### Key workflow (two-phase, snapshot-guarded)
1. `prepare_commit_review` → stages the diff, validates no conflicts, returns a snapshot hash + suggested message.
2. `commit` → re-validates the snapshot hash (prevents stale commits), then writes-tree → commit-tree → update-ref. If the repo changed, the user must prepare a fresh review (no auto-retry).
3. `prepare_push_review` → checks ahead/behind; `push` requires ahead>0 and behind=0, pushes `--porcelain --no-verify`.

### Optional Ollama analysis
Scopes: summary, file, hunk, groups, message, ci. System prompt: "You explain PortfolioLab development evidence. You have no write tools or authority." Evidence is treated as untrusted data; falls back to deterministic evidence if Ollama is unavailable.

### Launcher keys
**R** reconnect/bootstrap · **G** enter GitHub PAT · **Q** stop agent. Outputs `STUDIO_READY`, `STUDIO_BOOTSTRAP_READY`, `STUDIO_GITHUB_CONNECTED`, `STUDIO_ERROR`. Optional switches: `-GitHubCredential`, `-IncludeAiRepository`, `-OllamaModel`, `-Port`.

---

## 12. INFRASTRUCTURE & DEVOPS

### Docker Compose (`compose.yaml`)
| Service | Image | Port | Notes |
|---------|-------|------|-------|
| postgres | postgres:17 | 127.0.0.1:5432 | DB `portfoliolab`, user `portfoliolab`, password `${DB_PASSWORD}`; volume `postgres_data`; healthcheck `pg_isready` |
| kafka | apache/kafka:3.9.1 | 127.0.0.1:9092 | KRaft single-node, PLAINTEXT, `AUTO_CREATE_TOPICS_ENABLE=false`; volume `kafka_data` |

**Kafka topics (created manually):** `portfoliolab.notifications.v1` and `portfoliolab.market-intelligence.v1` (1 partition, 1 replica each).

**Credential caveat:** PostgreSQL initializes a role's password only when the volume is first created — editing `.env` later does **not** change an existing role's password.

### Key backend config (`application.properties`)
`ddl-auto=validate`, `open-in-view=false`, Kafka bootstrap `localhost:9092`, consumer group `portfoliolab-notifications-v1`, `auto-offset-reset=earliest`, `enable-auto-commit=false`, `ack-mode=record`, String serializers/deserializers.

### Startup order
1. `docker compose up -d postgres kafka` + create both Kafka topics.
2. `cd services/market-simulator && go run .` (:8081).
3. `.\scripts\Start-Backend.ps1` (:8080; wait for Flyway + health).
4. `cd frontend && npm.cmd run dev` (:3000).
5. Optional: AI service (:3101) + Ollama.
6. Optional: `.\scripts\start-developer-studio.ps1` (:4317).

### Critical warnings
- **Never** use `docker compose down -v` as a restart procedure (destroys data).
- **Never** commit `.env` files; **never** reuse historical demo credentials from Git history.
- **Do not expose publicly** — no auth, TLS, or production security.
- Stop services with Ctrl+C; `docker compose stop` retains data.

---

## 13. COMPLETE API REFERENCE

### Spring Boot backend (:8080) — base `http://127.0.0.1:8080/api`

**Assets & Portfolio**
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/assets` | List all assets (by symbol) |
| GET | `/portfolios/{id}` | Portfolio summary (cash, currency) |

**Simulated Orders (OMS)**
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/portfolios/{id}/simulated-orders` | Submit order |
| GET | `/portfolios/{id}/simulated-orders` | List orders (latest 100) |
| GET | `/portfolios/{id}/simulated-orders/{orderId}` | Order detail |
| POST | `/portfolios/{id}/simulated-orders/{orderId}/cancel` | Cancel order |
| GET | `/portfolios/{id}/simulated-orders/availability` | Buying power, reserved cash/shares |
| GET | `/portfolios/{id}/simulated-orders/events` | SSE event stream |
| POST | `/portfolios/{id}/orders/preview` | Advisory order preview |
| POST | `/portfolios/{id}/orders` | Legacy synchronous trade |

**Activity / History / Intelligence**
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/portfolios/{id}/activity` | Activity union |
| GET | `/portfolios/{id}/history` | Portfolio snapshots |
| GET | `/portfolios/{id}/performance?period=7D\|1M\|3M\|ALL` | Performance + attribution |
| POST | `/portfolios/{id}/rebalance/preview` | Rebalancing plan |

**Risk Lab / Research**
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/portfolios/{id}/risk-lab` | Exposure evaluation |
| POST | `/portfolios/{id}/risk-lab/scenario` | Scenario evaluation |
| GET | `/research/assets/{assetId}/history?from=&to=&period=` | Fictional OHLCV history |

**Notifications**
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/portfolios/{id}/notifications` | Paginated notifications |
| GET | `/portfolios/{id}/notifications/unread-count` | Unread count |
| PATCH | `/portfolios/{id}/notifications/{nid}/read` | Mark read |
| PATCH | `/portfolios/{id}/notifications/{nid}/unread` | Mark unread |
| GET/PUT | `/portfolios/{id}/notifications/preferences` | Preferences |

**Watchlists / Alerts / Market / FX**
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/POST | `/portfolios/{id}/watchlists` | Watchlists |
| PATCH/DELETE | `/portfolios/{id}/watchlists/{wid}` | Update/delete watchlist |
| POST/DELETE | `/portfolios/{id}/watchlists/{wid}/items` | Add/remove symbol |
| GET/POST | `/portfolios/{id}/price-alerts` | Price alerts |
| DELETE | `/portfolios/{id}/price-alerts/{aid}` | Cancel alert |
| GET | `/market/prices` | Current prices |
| GET | `/market/intelligence` | Intelligence feed |
| GET | `/fx/convert?from=&to=&amount=` | FX conversion |
| GET | `/fx/reference?from=&to=&date=` | Reference rates |
| POST | `/fx/attribution` | FX attribution |

**Dividends / Bonus / Business Rules / Reconciliation**
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/dividends/simulate` | Dividend simulation |
| POST | `/portfolios/{id}/dividends/credit` | Credit dividend |
| POST | `/dividends/schedules` | Scheduled dividend |
| POST | `/bonus/simulate` | Bonus simulation |
| POST | `/business-rules/evaluate` | Market rules |
| GET | `/portfolios/{id}/reconciliation` | Consistency report |
| GET | `/health` | Health check |

### Other services
- **Market simulator (:8081):** `GET /health`, `/prices`, `/ws/prices`, `/history`.
- **Ask AI (:3101):** `POST /api/portfolio/chat`, `/api/agents/business-rules/evaluate`, `/api/agents/bonus/simulate`, `/api/agents/dividend/simulate`, `GET /api/portfolio/:id/holdings`.
- **Developer Studio agent (:4317):** `POST /studio/bootstrap`, `/studio/tools`, `/studio/mcp`.

### Common schemas
```json
// OrderRequest
{ "assetId": 1, "type": "BUY|SELL", "quantity": 10, "orderType": "MARKET|LIMIT", "limitPrice": 100.0000, "timeInForce": "DAY|GTC" }
// OrderView
{ "id": 1, "portfolioId": 1, "assetId": 1, "side": "BUY", "requestedQuantity": 10, "filledQuantity": 0, "status": "SUBMITTED", "failureReason": null, "orderType": "MARKET", "limitPrice": null, "timeInForce": "GTC", "expiresAt": null }
// PortfolioResponse
{ "id": 1, "name": "Demo Portfolio", "cashBalance": 100000.0000, "currency": "INR" }
```
Errors return `{ "error": "message" }` with HTTP 400/404/409/502/503. All Next.js proxy responses use `Cache-Control: no-store`.

---

## 14. SECURITY BOUNDARIES & LIMITATIONS

### What is intentionally NOT provided
- **No authentication/authorization** — single-user demo; portfolio ID 1 hardcoded.
- **No TLS** — all HTTP is plaintext loopback.
- **No production secrets management** — `.env` is plaintext and git-ignored.
- **No multi-user ownership checks.**
- **No real exchange connectivity** and **no real money.**
- **No AI trading authority** — Ask AI is strictly read-only.

### Security measures that ARE present
- Developer Studio: origin restriction (localhost:3000 only), CSRF tokens, timing-safe secret comparison, credential redaction, sensitive-path detection, 2-minute single-use bootstrap, rate limiting.
- Git hooks and GPG signing disabled in Studio; no force push/pull/rebase.
- Kafka producer idempotence, `acks=all`, bounded timeouts.
- Database row-level locking (`FOR UPDATE`, `FOR SHARE`).
- Input validation on all endpoints; AI evidence sanitization (failures reasons withheld).

### Known limitations
- Historical order #2 has a pre-existing reconciliation exception.
- No idempotency key on order submission.
- Polling ends when no active orders remain, budget exhausted, or page unmounts.
- Order and portfolio GETs are separate reads, not one atomic snapshot.
- No contribution/withdrawal ledger; no historical FX series (multi-currency recorded snapshots withheld).
- AI model can invent incorrect explanations — always compare with API evidence.

> **How to say it:** "This is explicitly a local, single-user educational demo — not a production brokerage. It has no auth, TLS, or multi-tenant security by design, and I documented those boundaries clearly rather than pretending they're solved."

---

## 15. MILESTONES & RELEASE HISTORY (M31–M53)

| Milestone | Feature | Highlights |
|-----------|---------|-----------|
| **M31** | Simulated orders (OMS phase 1) | Durable lifecycle SUBMITTED→ACCEPTED→PARTIALLY_FILLED→FILLED/REJECTED/CANCELLED; V16 tables |
| **M32** | Execution receipts | One transaction per fill; V17 receipts; `ReconciliationService`; receipts are evidence not cash flow |
| **M33** | AI agents | Ask AI + Dividend/Bonus/Business-rules agents in sibling repo; 7 read-only MCP tools; Ollama |
| **M34** | Trading UI + async OMS | Next.js UI, Recent Orders, polling, cancellation; serial polling (3s, max 100 rounds, 3 failures) |
| **M35–M37** | Limits, reservations, streaming | V18 (LIMIT/DAY/GTC/EXPIRED), V19 (reservations), V20 (events+trigger); SSE; BUY reserves qty×ceil4(limit×FX×1.05) |
| **M38–M40** | Research + Risk Lab + AI copilot | V21 candles; deterministic Go `/history`; SMA/EMA/RSI/volatility; HHI, drawdown; 90-day history for historical metrics |
| **M41–M43** | Notifications, activity, preferences | V22; Kafka outbox (max 25 events, acks=all); consumer dedup via receipts; 8 preference types; 90-day retention |
| **M44–M46** | Portfolio intelligence | Performance periods 7D/1M/3M/ALL; per-asset attribution; read-only rebalancing planner (whole shares, 5% buffer) |
| **M47–M49** | Developer Studio | `/developer`; agent :4317; origin-restricted, CSRF, 2-min bootstrap, snapshot-guarded commits |
| **M50–M53** | Stabilization (Oct 17, 2026) | Lint 20 errors→0; isolated test DBs; UTC startup fix; real-service flow; AI/MCP evidence verified |

### Verification results (Oct 17, 2026)
- Frontend: **57 tests**, zero lint issues, production build (39 pages).
- Backend: **144 tests**, zero failures/errors/skips.
- Go: **4 tests** + `go vet` clean.
- AI: **73 tests** + typecheck clean.
- Developer Agent: **20 tests** + typecheck clean.
- Real-service flow checks: passed with Next, Spring, PostgreSQL, Kafka, Go running.

**Release status:** Not ready for unconditional main-branch release — main is **21 ahead / 1 behind** origin/main, and the AI checkout has local revisions.

---

## 16. KNOWN ISSUES & TECHNICAL DEBT

Be ready to discuss these honestly — employers respect awareness of your own gaps:

- **Historical order #2** has a pre-existing reconciliation exception (`INVALID_UNFILLED_STATUS`: REJECTED with 3/4 filled, "Order total exceeds supported precision").
- **No idempotency key** on order submission (a double-click could theoretically submit twice).
- **No clean database dump** for a reconciliation SQL integration test.
- **No application Dockerfiles** — the five native services each run in their own terminal; only Postgres + Kafka are containerized.
- **`.env` is plaintext**; a fixed dev password exists in old Git history (the newer `.env` variable does not remove it from history).
- **V23 migration file** is referenced in docs but not present in the repository.
- **Some Java files sit in unusually deep, repeated source paths** (e.g., `.../portfolio/backend/src/...`). Maven still compiles them (search by class name when navigating); these are not application components.
- **No authentication, TLS, multi-user ownership, or production security** (by design — see §14).
- **No contribution/withdrawal ledger** — initial deposits cannot be reconstructed.
- **No historical FX series** — multi-currency recorded snapshots are withheld.

---

## 17. HOW TO RUN IT (WINDOWS QUICK START)

> Full guide: `docs/WINDOWS-QUICKSTART.md`. Use native Windows PowerShell 5.1 or PowerShell 7. The AI launcher explicitly invokes `npx.cmd`.

1. Install: Git 2.x, Node.js 24.12+, JDK 21 (Temurin, with `JAVA_HOME`), Go 1.27.0+, Docker Desktop (WSL2), Ollama 0.40.4+. Reopen the terminal afterward.
2. `docker compose up -d postgres kafka`, then create both Kafka topics manually.
3. `cd services/market-simulator && go run .` → :8081.
4. `.\scripts\Start-Backend.ps1` → :8080 (wait for Flyway V1–V23 + `/api/health`).
5. `cd frontend && npm.cmd run dev` → :3000.
6. Optional AI: start Ollama, `ollama pull qwen2.5:0.5b`, then `cd portfoliolab-ai && npm.cmd start` → :3101.
7. Optional Studio: `.\scripts\start-developer-studio.ps1` → :4317 (opens `/developer` with a one-time bootstrap).

### Build & test commands
```
# Frontend
npm.cmd run lint ; npx.cmd tsc --noEmit ; npm.cmd run build
npm.cmd run test:m34 / m35-m37 / m38-m40 / m41-m43 / m44-m46
# Backend
.\mvnw.cmd test        # (runs in UTC)
.\mvnw.cmd -DskipTests package
# Go
go test -count=1 ./... ; go vet ./...
# AI + Developer Agent
npm.cmd test ; npm.cmd run typecheck
```

### Common problems & fixes
| Symptom | Fix |
|---------|-----|
| Docker named pipe missing | Start Docker Desktop; wait for the Linux engine; check WSL2 v2 |
| PostgreSQL auth failure | Use the password that initialized the volume; editing `.env` won't change an existing role's password |
| Kafka timeout / unknown topic | Wait for broker readiness; create both topics manually (auto-create is disabled) |
| Flyway checksum error | Do **not** edit applied migrations or blindly repair; use a clean clone |
| Maven/Java error | Verify JDK 21, `JAVA_HOME`, and network/proxy access; wrapper pins Maven 3.10.0 |
| AI 502 / MCP ENOENT | Run AI from its repo root after `npm ci`; ensure `npx.cmd` on PATH and Spring on 8080 |
| Ollama refused / model missing | Start Ollama; `ollama pull qwen2.5:0.5b`; check `http://127.0.0.1:11434/api/tags` |
| Empty holdings/charts/orders | Fresh seed has **no trades** — make a small demo buy and wait for final status |
| Build can't fetch Geist fonts | Allow HTTPS to `fonts.googleapis.com` and `fonts.gstatic.com` |
| FX reference unavailable | Frankfurter FX needs external internet, independent of the local simulator |
| Port 3001 instead of 3000 | Free port 3000 — Studio's origin check requires exactly `localhost:3000` |

---

## 18. VERIFICATION & TEST EVIDENCE

**Final verification date:** October 17, 2026 (M50–M53). Every suite passed:
- Frontend: 57 tests, zero lint errors/warnings, `tsc --noEmit` clean, production build 39 pages.
- Backend: 144 tests, zero failures/errors/skips, packaged successfully.
- Go: 4 tests + `go vet` clean.
- AI: 73 tests + typecheck clean.
- Developer Agent: 20 tests + typecheck clean.
- Real-service flow checks: passed with Next, Spring, PostgreSQL, Kafka, and Go running together.

**Test-count check:** 57 + 144 + 4 + 73 + 20 = **298 automated tests passing.**

---

## 19. FAQ — ANTICIPATED EMPLOYER QUESTIONS (WITH ANSWERS)

**Q: What is this project in one sentence?**
A: A fully local, simulated trading platform — Next.js dashboard + Spring Boot API + PostgreSQL + Kafka + Go price simulator + a local-LLM "Ask AI" copilot — built to demonstrate end-to-end full-stack and fintech engineering with zero real money or exchange connectivity.

**Q: Is it production-ready? Will it handle real money?**
A: No, and it's not meant to be. It's a single-user educational system with no auth, TLS, or multi-tenant security by design. What *is* production-grade is the engineering discipline: versioned migrations, event-driven notifications via a transactional outbox, pessimistic locking around cash, reconciliation checks, and 298 passing tests.

**Q: What was your specific role / did you build all of it?**
A: [Customize this] It's a workspace with 5 services; be ready to say which parts you authored vs. collaborated on, and which milestone (M31–M53) each piece maps to.

**Q: Why did you choose Spring Boot for the backend?**
A: To model a realistic fintech backend: strong typing, JPA + pessimistic locking for money safety, Flyway for auditable schema evolution, and first-class Kafka support for event-driven notifications.

**Q: How do you prevent double-spending or race conditions when two orders hit at once?**
A: Every money-moving operation takes a pessimistic row lock (`SELECT ... FOR UPDATE`) on the portfolio row, and cash/share reservations (with a 5% buffer) are recorded before settlement. Negative balances are blocked by an entity/DB constraint.

**Q: What is the "transactional outbox" pattern and why use Kafka at all?**
A: Instead of writing to the DB and then calling Kafka (which can desync if one fails), domain events are written to a `notification_outbox` table in the same transaction. A publisher drains the outbox to Kafka, and a consumer persists notifications — so the event and the state change are atomic.

**Q: How does the AI avoid hallucinating my balances?**
A: It mostly doesn't use the LLM for facts. Order/reconciliation questions go through a *deterministic intent router* to fixed, read-only MCP tools that return validated JSON evidence. The LLM is only used for explanations, with a system prompt forbidding invented balances, plus sanitization that withholds internal failure reasons.

**Q: Why MCP (Model Context Protocol)?**
A: It gives the LLM a fixed, auditable, read-only tool surface (7 tools, `readOnlyHint: true`) instead of arbitrary API access — the safest way to wire an LLM to a financial system.

**Q: Why a separate Go service for prices?**
A: To practice polyglot microservices and real-time streaming: Go handles many WebSocket connections cheaply, pushes a tick every 5 seconds, and generates *deterministic* (seeded) historical OHLCV so charts are reproducible for testing.

**Q: How do you handle real-time updates in the UI?**
A: Server-Sent Events from Spring (`/simulated-orders/events`) proxied through Next.js, with an automatic fallback to bounded serial polling (3s interval, max 100 requests, max 3 errors) if the SSE connection drops.

**Q: How do you keep the database schema safe?**
A: Flyway migrations (V1–V23) run automatically and are never edited after applying; Hibernate runs in `validate` mode so any drift between code and schema fails fast at startup. No hand-run SQL, no auto-DDL.

**Q: What was the hardest technical problem you solved?**
A: [Customize — strong candidates: the order reservation/settlement engine; the reconciliation SQL that cross-checks orders, fills, receipts and transactions across 14 exception types; wiring SSE with a polling fallback; or the snapshot-guarded commit flow in Developer Studio.]

**Q: What would you do next to make it production-ready?**
A: Add real authentication/authorization with per-user portfolio ownership, TLS and secret management, containerize the five services, add an idempotency key to order submission, introduce a historical FX series and a contribution/withdrawal ledger, model fees, and expand reconciliation into a CI integration test against a clean database.

**Q: How do you know it works? / How do you test it?**
A: Five independent suites totaling 298 tests (frontend 57, backend 144, Go 4, AI 73, Studio 20), plus lint, typecheck, production builds, `go vet`, and a real-service end-to-end flow check with all services running (verified Oct 17, 2026).

**Q: Any known bugs or things you'd fix?**
A: Yes — documented in §16. The most notable is a pre-existing reconciliation exception on historical order #2, and there's no idempotency key on submission. I track these explicitly rather than hiding them.

**Q: Is the AI safe? Can it place trades?**
A: No. Every AI tool is read-only (`readOnlyHint: true`, `destructiveHint: false`); there is no trade-placement tool. The model can still produce incorrect explanations, so answers are meant to be compared against the API evidence.

**Q: Why is portfolio ID 1 hardcoded?**
A: It's a deliberate single-user demo scope, documented as a security boundary — there is no multi-user ownership model to enforce.

**Q: Can I see it running?**
A: Yes — start Postgres + Kafka, the Go simulator, the Spring backend, and the Next frontend, then open `http://localhost:3000`. A fresh database has no holdings, so place a small demo buy to see the order lifecycle, charts, and notifications populate.

---

*End of document. For line-level detail, see the 10-part `DOCUMENTATION_*.md` series and the milestone guides in `docs/`.*














