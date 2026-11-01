# Prompt Log – How PortfolioLab was built

Below is a concise catalogue of the prompts given to the AI (Cline) that produced the code base, together with the primary feature each prompt created.  The prompts are numbered in the order they were issued; each entry maps to a section of the final system.

| # | Prompt summary (truncated) | Main feature(s) created |
|---|---|---|
| **P1** | "Create a complete Python FastAPI backend for a fintech simulated trading app, mirroring a Java Spring‑Boot OMS. Include lifespan lifecycles, CORS, Prometheus metrics, correlation‑ID, X‑Cache middleware, and exception handlers." | Project scaffolding, `app/main.py`, health checks, middleware, metrics |
| **P2** | "Add a pydantic‑settings `Settings` class reading from `.env`; DB URL, Ollama host/model, CORS origins, embedding dimension 768." | `app/core/config.py`, environment configuration |
| **P3** | "Generate SQLAlchemy 2.x model files for User, Asset, Portfolio, Holding, SimulatedOrder, AuditLog, FxRate, HistoryCandle, NotificationPreferences, OutboxEvent, IntelligenceNote, MarketPriceAlert, RefreshToken, Watchlist, WatchlistItem, Activity, Execution." | All ORM models (`app/models/*.py`) |
| **P4** | "Create schema files mirroring every model, with `from_attributes=True`, plus DTOs for alerts, risk, search, FX conversion." | Pydantic schemas (`app/schemas/*.py`) |
| **P5** | "Implement FastAPI routers for health, auth (register/login/refresh/me), assets (list, by‑id), portfolios (list, detail, performance), simulated orders (create, list, status update), market prices (proxy to Go simulator, X‑Cache), semantic search (Ollama embed, pgvector), notifications (list, preferences, order events), risk‑lab (HHI, volatility, drawdown, shock), FX (convert, reference, attribution), watchlists (CRUD), activity (placeholder)." | All API routes (`app/api/routes/*.py`) |
| **P6** | "Add JWT (HS256) token creation/verification, password hashing with passlib (bcrypt/sha256_crypt/argon2), role‑based dependency `require_role`, rate limiting with slowapi (200/min default, 10/min on auth)." | Security (`app/core/security.py`), auth flow |
| **P7** | "Build an execution engine that pulls price from `http://127.0.0.1:8081/prices`, fills MARKET orders at current price, fills LIMIT orders only when price crosses limit, supports DAY/GTC time‑in‑force, and updates order status accordingly." | `app/services/execution_engine.py`, order‑fill logic |
| **P8** | "Implement a ReservationManager that reserves cash for BUY orders and reserves shares for SELL orders, and releases them on cancel/partial fill." | `app/services/reservation_manager.py` |
| **P9** | "Create a NotificationService with 8 types (ORDER_PLACED, ORDER_FILLED, ORDER_CANCELLED, ORDER_REJECTED, PRICE_ALERT, PORTFOLIO_REBALANCE, DAILY_SUMMARY, RISK_WARNING), dedup by receipt_id, 90‑day retention, and Kafka event production on order lifecycle changes." | `app/services/notification_service.py`, outbox/Kafka integration |
| **P10** | "Add static methods to calculate HHI, annualised volatility (log‑returns, √252), max draw‑down, and a shock‑scenario applicator with correlation factor." | `app/services/risk_service.py` |
| **P11** | "Wrap Ollama `/api/embeddings` endpoint, validate 768‑dim output, and implement a pgvector cosine‑similarity search that returns ranked `AssetSearchResult` objects." | `app/services/embedding_service.py`, `app/services/search_service.py`, semantic search |
| **P12** | "Implement `/api/fx/convert` that divides the price of the target asset by the source asset price; also add a reference‑rates endpoint that returns 1/price for each asset vs a base currency." | `app/services/fx_service.py`, FX conversion |
| **P13** | "Define a `docker-compose.yaml` that spins up PostgreSQL 17, Kafka 3.9.1, a Go market‑simulator image, Ollama container, and the FastAPI backend; add health checks and service dependencies." | `compose.yaml`, Docker orchestration |
| **P14** | "Add Makefile targets `make run‑backend`, `make migrate`, `make test`, `make lint`, `make docker‑up`, `make docker‑down`; create `run‑backend.sh` and PowerShell equivalents." | `Makefile`, `scripts/` |
| **P15** | "Create a Next.js 16 app with pages for login, dashboard, portfolio, trade form, watchlist, risk lab, research terminal, AI chat; integrate with FastAPI via `BACKEND_URL`; use Tailwind, Recharts, and MCP client for AI explanations." | Frontend (`frontend/`), UI components |

*Each prompt was engineered to produce a cohesive, production‑style codebase; the resulting files are the ones inspected in the deep‑dive report.*

---
*Log compiled 2026‑10‑27.*