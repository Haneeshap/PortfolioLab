# PortfolioLab Backend Audit Report - TRIMMED

## Overview
Trimmed PortfolioLab backend-python codebase to remove bloat, following interview-ready specifications.

### Feature Audit (KEEP version)

| Feature | File Location | What It Does | Library | DB Table |
|---------|---------------|-------------|---------|----------|
| **Auth** | `app/core/security.py` | JWT authentication, password hashing, RBAC | passlib, jose, slowapi | `users` |
| **Portfolio** | `app/api/routes/portfolios.py` | Portfolio CRUD, performance tracking | FastAPI, SQLAlchemy, Pydantic | `portfolios`, `holdings`, `transactions` |
| **Trading** | `app/services/oms_service.py` / `order_service.py` | Order creation, validation, lifecycle management | SQLAlchemy, httpx | `simulated_orders`, `outbox_events` |
| **Risk** | `app/services/risk.py` | HHI, volatility, max_drawdown (3 functions) | numpy | `risk_policies` |
| **Price Feed** | `app/market.py` / `market_service.py` | Go market simulator price feed | httpx | (external Go simulator) |
| **FX** | `app/services/fx.py` / `app/api/routes/fx.py` | Currency conversion using reference rates | Custom FX reference rates | `assets`, `fx_rates` |
| **Watchlists** | `app/api/routes/watchlists.py` | Create/list/watchlists of symbols | FastAPI, SQLAlchemy | `watchlists`, `watchlist_items` |
| **Semantic Search** | `app/api/routes/search.py` / `search_service.py` / `embedding_service.py` | Ollama embeddings + pgvector similarity | httpx, SQLAlchemy+pgvector | `assets`, `asset_search_embeddings` |
| **Notifications** | `app/api/routes/notifications.py` / `notification_service.py` / `core/kafka.py` | Outbox pattern, 3 event types, Kafka publishing | aiokafka, fastapi, SQLAlchemy | `notifications`, `outbox_events` |
| **AI Research** | `app/models/intelligence_notes.py` | Market intelligence notes | SQLAlchemy, httpx | `intelligence_notes` |
| **Audit Log** | `app/core/audit.py` / `models/audit_log.py` | Audit middleware logging POST/PUT/DELETE | structlog, SQLAlchemy | `audit_log` |

### 72-Day Plan Mapping (Trimmed)

| Plan Phase | Days | Mapped Features |
|------------|------|-----------------|
| **Phase 1** | Days 1-8 | Python, FastAPI, Pydantic, JWT, RBAC → **Auth** |
| **Phase 2** | Days 17-23 | Docker, Postgres, Redis, Kafka → **Notifications**, **FX**, **Price Feed** |
| **Phase 3** | Days 24-29 | SQL, ETL, Risk, Security → **Risk**, **Audit Log** |
| **Phase 4** | Days 50-58 | Spark, Airflow, Delta, dbt → **AI Research** (intelligence notes) |
| **Phase 5** | Days 59-70 | Evals → **Semantic Search** (Ollama + pgvector evals) |

### Trim Changes Completed

1. **Rebalancing planner**: Already removed (didn't exist)
2. **FX simplified**: `app/services/fx.py` with `convert(amount, from, to)` using reference rates
3. **Risk simplified**: `app/services/risk.py` with 3 functions (HHI, volatility, max_drawdown)
4. **Notifications simplified**: 3 event types (order.filled, order.rejected, order.expired)
5. **Migrations squashed**: 5 migrations (initial, auth, portfolios, orders, vector extension)
6. **Frontend pages**: Deleted /fx-advanced, kept /portfolio, /watchlist

**Output Decision: KEEP** - Full audit table with trim summary, interview-ready documentation.