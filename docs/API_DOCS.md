# PortfolioLab API Documentation

*Generated from source‑code inspection (FastAPI backend). OpenAPI at `http://localhost:8000/docs`.*

## 1. Health
- `GET /api/health/live` – liveness probe → `{"status":"alive"}`
- `GET /api/health/ready` – readiness → `{"status":"ready","checks":{...}}`

## 2. Authentication
- `POST /api/auth/register` – register user (email, password, optional role)
- `POST /api/auth/login` – login → JWT access & refresh tokens (rate‑limit 10/min)
- `POST /api/auth/refresh` – refresh access token
- `GET /api/auth/me` – current user profile (JWT required)

## 3. Assets
- `GET /api/assets` – list, optional query `q` and `limit`
- `GET /api/assets/{asset_id}` – get by ID

## 4. Portfolios
- `GET /api/portfolios` – paginated list (`page`, `limit`, `sort`, `order`)
- `GET /api/portfolios/{id}` – detail
- `GET /api/portfolios/{id}/performance` – performance for `7D|1M|3M|ALL`

## 5. Simulated Orders
- `POST /api/simulated-orders` – create order (portfolio_id, symbol, side, order_type, limit_price?, time_in_force, expires_at?)
- `GET /api/simulated-orders` – list, filterable by `portfolio_id` and `status`
- `GET /api/simulated-orders/{order_id}` – get order
- `PATCH /api/simulated-orders/{order_id}/status` – update status (enum: SUBMITTED|ACCEPTED|PARTIALLY_FILLED|FILLED|REJECTED|CANCELLED|EXPIRED)

*Order types: MARKET fills at current price; LIMIT fills only when market price crosses limit. Time‑in‑force: DAY (end‑of‑day), GTC (until cancelled).*

## 6. Market Data
- `GET /api/market/prices` – current simulated prices + `X‑Cache: HIT/MISS` header (Redis cache → Go simulator)
- `GET /api/market/orders` – orders with current prices attached

## 7. Search (Semantic)
- `GET /api/search/semantic` – embed query via Ollama (`nomic‑embed‑text`), rank assets by pgvector cosine similarity
- Query params: `q` (required), `limit` (1‑50)

## 8. Notifications
- `GET /api/notifications` – list (paginated)
- `GET /api/notifications/unread-count` – unread count
- `POST /api/notifications/preferences` – set preferences (email, push, sms, frequency)
- `POST /api/notifications/order-placed` / `order-filled` – produce Kafka events (8 types, dedup by receipt_id, 90‑day retention)

## 9. Risk Lab
- `GET /api/risk-lab` – HHI, volatility, max draw‑down, timestamp
- `GET /api/risk-lab/scenario` – apply shock % & correlation → original/shocked values, impact_pct

## 10. FX Conversion
- `GET /api/fx/convert` – convert amount using asset price ratios (`from_symbol`, `to_symbol`, `amount`)
- `GET /api/fx/reference` – reference rates vs a base currency
- `GET /api/fx/attribution` – FX attribution for a portfolio

## 11. Watchlists
- `GET /api/watchlists` – list
- `GET /api/watchlists/{id}` – get
- `POST /api/watchlists` – create (`name`, `symbols` comma‑separated)
- `POST /api/watchlists/{id}/symbols` – add symbols
- `DELETE /api/watchlists/{id}/symbols/{symbol}` – remove symbol

## 12. Activity (placeholder)
- `GET /api/activity` – activity feed
- `GET /api/activity/history` – activity history

**Status codes**: 200 success, 400 validation, 401 auth, 403 permissions, 422 Pydantic, 503 unavailable.

*All routes auto‑generate OpenAPI 3.1 schema; download via `/openapi.json`.*

*Document generated 2026‑10‑27.*