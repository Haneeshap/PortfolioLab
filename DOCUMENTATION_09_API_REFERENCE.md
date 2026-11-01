# DOCUMENTATION 09 — Complete API Reference

## 1. Spring Boot Backend (port 8080)

Base path: `http://127.0.0.1:8080/api`

### Assets
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/assets` | List all assets (sorted by symbol) |

### Portfolio
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/portfolios/{id}` | Portfolio summary (cash, currency) |

### Simulated Orders (OMS, M31–M37)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/portfolios/{id}/simulated-orders` | Submit order |
| GET | `/portfolios/{id}/simulated-orders` | List orders (latest 100) |
| GET | `/portfolios/{id}/simulated-orders/{orderId}` | Order detail |
| POST | `/portfolios/{id}/simulated-orders/{orderId}/cancel` | Cancel order |
| GET | `/portfolios/{id}/simulated-orders/availability` | Buying power, reserved cash/shares |
| GET | `/portfolios/{id}/simulated-orders/events` | SSE event stream |

### Orders (Legacy)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/portfolios/{id}/orders/preview` | Advisory order preview |
| POST | `/portfolios/{id}/orders` | Legacy synchronous trade |

### Activity / History
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/portfolios/{id}/activity` | Activity union |
| GET | `/portfolios/{id}/history` | Portfolio snapshots |

### Intelligence (M44–M46)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/portfolios/{id}/performance?period=7D\|1M\|3M\|ALL` | Performance + attribution |
| POST | `/portfolios/{id}/rebalance/preview` | Rebalancing plan |

### Risk Lab / Research (M38–M40)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/portfolios/{id}/risk-lab` | Exposure evaluation |
| POST | `/portfolios/{id}/risk-lab/scenario` | Scenario evaluation |
| GET | `/research/assets/{assetId}/history?from=&to=&period=` | Fictional OHLCV history |

### Notifications (M41–M43)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/portfolios/{id}/notifications` | Paginated notifications |

## 2. Next.js Frontend API Proxy Routes (port 3000)

| Route | Method | Upstream |
|-------|--------|----------|
| `/api/portfolio` | GET | portfolios/1 + holdings + transactions |
| `/api/portfolio/simulated-orders` | GET/POST | portfolios/1/simulated-orders |
| `/api/portfolio/simulated-orders/[orderId]` | GET | portfolios/1/simulated-orders/{id} |
| `/api/portfolio/simulated-orders/[orderId]/cancel` | POST | portfolios/1/simulated-orders/{id}/cancel |
| `/api/portfolio/simulated-orders/availability` | GET | portfolios/1/simulated-orders/availability |
| `/api/portfolio/simulated-orders/events` | GET | SSE proxy |
| `/api/portfolio/orders/preview` | POST | portfolios/1/orders/preview |
| `/api/portfolio/orders` | POST | portfolios/1/orders |
| `/api/portfolio/activity` | GET | portfolios/1/activity |
| `/api/portfolio/history` | GET | portfolios/1/history |
| `/api/portfolio/intelligence` | GET/POST | portfolios/1/performance + /rebalance/preview |
| `/api/portfolio/risk-lab` | GET/POST | portfolios/1/risk-lab + /scenario |
| `/api/portfolio/notifications` | GET | portfolios/1/notifications |
| `/api/portfolio/notifications/preferences` | GET/PUT | portfolios/1/notifications/preferences |
| `/api/portfolio/notifications/unread-count` | GET | portfolios/1/notifications/unread-count |
| `/api/portfolio/watchlists` | GET/POST | portfolios/1/watchlists |
| `/api/portfolio/watchlists/[id]` | PATCH/DELETE | portfolios/1/watchlists/{id} |
| `/api/portfolio/watchlists/[id]/items` | POST | portfolios/1/watchlists/{id}/items |
| `/api/portfolio/watchlists/[id]/items/[symbol]` | DELETE | portfolios/1/watchlists/{id}/items/{symbol} |
| `/api/portfolio/price-alerts` | GET/POST | portfolios/1/price-alerts |
| `/api/portfolio/price-alerts/[id]` | DELETE | portfolios/1/price-alerts/{id} |
| `/api/market/prices` | GET | /api/market/prices |
| `/api/market/intelligence` | GET | /api/market/intelligence |
| `/api/fx/reference` | GET | /api/fx/reference |
| `/api/fx/attribution` | POST | /api/fx/attribution |
| `/api/research/assets/[assetId]/history` | GET | /api/research/assets/{id}/history |
| `/api/ai/chat` | POST | http://127.0.0.1:3101/api/portfolio/chat |
| `/api/ai/agents/bonus/simulate` | POST | http://127.0.0.1:3101/api/agents/bonus/simulate |
| `/api/ai/agents/business-rules/evaluate` | POST | http://127.0.0.1:3101/api/agents/business-rules/evaluate |
| `/api/ai/agents/dividend/simulate` | POST | http://127.0.0.1:3101/api/agents/dividend/simulate |

All proxy responses use `Cache-Control: no-store`.

## 3. Market Simulator (port 8081)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Service status |
| GET | `/prices` | Current prices |
| GET | `/ws/prices` | WebSocket live prices |
| GET | `/history?symbol=&from=&to=` | Fictional OHLCV history |

## 4. Ask AI Service (port 3101)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/portfolio/chat` | Ask AI chat |
| POST | `/api/agents/business-rules/evaluate` | Market rules |
| POST | `/api/agents/bonus/simulate` | Bonus simulation |
| POST | `/api/agents/dividend/simulate` | Dividend simulation |
| GET | `/api/portfolio/:id/holdings` | Holdings |

## 5. Developer Studio Agent (port 4317)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/studio/bootstrap` | POST | Session bootstrap |
| `/studio/tools` | POST | Read tool dispatch |
| `/studio/mcp` | POST | MCP endpoint |

## 6. Common Schemas

### OrderRequest
```json
{ "assetId": 1, "type": "BUY|SELL", "quantity": 10, "orderType": "MARKET|LIMIT", "limitPrice": 100.0000, "timeInForce": "DAY|GTC" }
```

### OrderView
```json
{ "id": 1, "portfolioId": 1, "assetId": 1, "side": "BUY", "requestedQuantity": 10, "filledQuantity": 0, "status": "SUBMITTED", "failureReason": null, "orderType": "MARKET", "limitPrice": null, "timeInForce": "GTC", "expiresAt": null }
```

### PortfolioResponse
```json
{ "id": 1, "name": "Demo Portfolio", "cashBalance": 100000.0000, "currency": "INR" }
```

### FxConversionResponse
```json
{ "fromCurrency": "USD", "toCurrency": "INR", "originalAmount": 100, "convertedAmount": 8500, "effectiveRate": 85.0, "rateSource": "SIMULATED" }
```

Errors return `{ "error": "message" }` with HTTP 400/404/409/502/503.
| GET | `/portfolios/{id}/notifications/unread-count` | Unread count |
| PATCH | `/portfolios/{id}/notifications/{nid}/read` | Mark read |
| PATCH | `/portfolios/{id}/notifications/{nid}/unread` | Mark unread |
| GET/PUT | `/portfolios/{id}/notifications/preferences` | Preferences |

### Watchlists / Price Alerts / Market / FX
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/POST | `/portfolios/{id}/watchlists` | Watchlists |
| PATCH/DELETE | `/portfolios/{id}/watchlists/{wid}` | Watchlist item |
| POST/DELETE | `/portfolios/{id}/watchlists/{wid}/items` | Add/remove symbol |
| GET/POST | `/portfolios/{id}/price-alerts` | Price alerts |
| DELETE | `/portfolios/{id}/price-alerts/{aid}` | Cancel alert |
| GET | `/market/prices` | Current prices |
| GET | `/market/intelligence` | Intelligence feed |
| GET | `/fx/convert?from=&to=&amount=` | FX conversion |
| GET | `/fx/reference?from=&to=&date=` | Reference rates |
| POST | `/fx/attribution` | FX attribution |

### Dividends / Bonus / Business Rules
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/dividends/simulate` | Dividend simulation |
| POST | `/portfolios/{id}/dividends/credit` | Credit dividend |
| POST | `/dividends/schedules` | Scheduled dividend |
| POST | `/bonus/simulate` | Bonus simulation |
| POST | `/business-rules/evaluate` | Market rules |

### Reconciliation / Health
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/portfolios/{id}/reconciliation` | Consistency report |
| GET | `/health` | Health check |