# DOCUMENTATION 03 — Frontend Deep Dive (Next.js 16 / React 19 / TypeScript)

## 1. Overview

- **Framework:** Next.js 16.4.0, App Router, React 19.3.0, TypeScript 5, Tailwind CSS 4
- **Charts:** Recharts
- **Build:** `npm.cmd ci`, `npm.cmd run dev` (port 3000), `npm.cmd run build`, `npx.cmd tsc --noEmit`, `npm.cmd run lint`
- **Configuration:** `frontend/.env.local` (copy of `.env.example`), `BACKEND_URL` env var (defaults to `http://localhost:8080`)
- **All API responses use `Cache-Control: no-store`**
- **Demo portfolio ID 1 is hardcoded** throughout (no multi-user ownership)

## 2. Page Routes

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
| `/agents` | Dividend/Bonus/Business-rules agents |
| `/watchlists` | Watchlists |
| `/fx` | FX conversion + attribution |
| `/intelligence` | Market intelligence feed |
| `/developer` | Developer Studio |

## 3. API Proxy Routes (Next.js → Spring Boot)

| Route | Method | Upstream | Purpose |
|-------|--------|----------|---------|
| `api/portfolio` | GET | portfolios/1 + holdings + transactions | Aggregated portfolio data |
| `api/portfolio/simulated-orders` | GET/POST | portfolios/1/simulated-orders | List/submit M31 orders |
| `api/portfolio/simulated-orders/[orderId]` | GET | portfolios/1/simulated-orders/{id} | Order detail |
| `api/portfolio/simulated-orders/[orderId]/cancel` | POST | portfolios/1/simulated-orders/{id}/cancel | Cancel order |
| `api/portfolio/simulated-orders/availability` | GET | portfolios/1/simulated-orders/availability | Buying power / reserved shares |
| `api/portfolio/simulated-orders/events` | GET | portfolios/1/simulated-orders/events | SSE event stream proxy |
| `api/portfolio/orders/preview` | POST | portfolios/1/orders/preview | Order preview (advisory) |
| `api/portfolio/orders` | POST | portfolios/1/orders | Legacy synchronous trade |
| `api/portfolio/activity` | GET | portfolios/1/activity | Activity union |
| `api/portfolio/history` | GET | portfolios/1/history | Portfolio snapshots history |
| `api/portfolio/intelligence` | GET/POST | portfolios/1/performance + /rebalance/preview | Performance + planner |
| `api/portfolio/risk-lab` | GET/POST | portfolios/1/risk-lab + /scenario | Risk lab |
| `api/portfolio/notifications` | GET | portfolios/1/notifications | Notifications |
| `api/portfolio/notifications/preferences` | GET/PUT | portfolios/1/notifications/preferences | Preferences |
| `api/portfolio/notifications/unread-count` | GET | portfolios/1/notifications/unread-count | Unread count |
| `api/portfolio/watchlists` | GET/POST | portfolios/1/watchlists | Watchlists |
| `api/portfolio/watchlists/[id]` | PATCH/DELETE | portfolios/1/watchlists/{id} | Watchlist item |
| `api/portfolio/watchlists/[id]/items` | POST | portfolios/1/watchlists/{id}/items | Add item |
| `api/portfolio/watchlists/[id]/items/[symbol]` | DELETE | portfolios/1/watchlists/{id}/items/{symbol} | Remove item |
| `api/portfolio/price-alerts` | GET/POST | portfolios/1/price-alerts | Price alerts |
| `api/portfolio/price-alerts/[id]` | DELETE | portfolios/1/price-alerts/{id} | Cancel alert |
| `api/market/prices` | GET | /api/market/prices | Current prices |
| `api/market/intelligence` | GET | /api/market/intelligence | Intelligence feed |
| `api/fx/reference` | GET | /api/fx/reference | FX reference rates |
| `api/fx/attribution` | POST | /api/fx/attribution | FX attribution |
| `api/research/assets/[assetId]/history` | GET | /api/research/assets/{id}/history | Research history |
| `api/ai/chat` | POST | http://127.0.0.1:3101/api/portfolio/chat | Ask AI |
| `api/ai/agents/bonus/simulate` | POST | http://127.0.0.1:3101/api/agents/bonus/simulate | Bonus agent |
| `api/ai/agents/business-rules/evaluate` | POST | http://127.0.0.1:3101/api/agents/business-rules/evaluate | Business rules agent |
| `api/ai/agents/dividend/simulate` | POST | http://127.0.0.1:3101/api/agents/dividend/simulate | Dividend agent |

## 4. Client Libraries

### simulated-orders.ts
- `DEMO_PORTFOLIO_ID = 1`, `OMS_PATH = "/api/portfolio/simulated-orders"`
- `ORDER_STATUSES = [SUBMITTED, ACCEPTED, PARTIALLY_FILLED, FILLED, CANCELLED, REJECTED, EXPIRED]`
- `SimulatedOrder` type with full validation; `OrderInput` type for submissions
- `validId(value)` — positive safe integer; `validOrderInput(value)` — validates assetId, side, orderType, timeInForce, limitPrice, quantity (≤ 13 digits)
- `parseOrder(value, orderId?)` / `parseOrders(value)` — strict validation of backend responses
- `isActiveOrder(order)` — SUBMITTED/ACCEPTED/PARTIALLY_FILLED; `orderIsConsistent(order)` — filled <= requested
- `cancellationPrompt(order)` — confirmation warning about existing fills

## 5. Key Components

### TradeForm.tsx (`"use client"`)
- Asset selection (with URL `assetId` deep-link), side (BUY/SELL), orderType (MARKET/LIMIT), limitPrice, timeInForce (DAY/GTC), quantity
- Live quote from `useMarketPrices()` (WebSocket-backed)
- Order preview: estimated price, asset total, FX rate, portfolio total, available cash, estimated charges, sufficient cash, cash after, allocation %
- Market-rule checks via `assessOrder` / `parseRuleResult` (calls `/api/business-rules/evaluate`)
- Validation is informational only — does not reserve cash, lock price, or execute
- Renders `RecentOrders` after the form
- Displays error/success messages

### RecentOrders.tsx (`"use client"`)
- Table of latest 100 M31 orders plus tracked active orders
- Columns: Order/Asset, Status, Requested, Filled, Unfilled, Actions (Details, Cancel)
- Cancel confirmation via `cancelWithConfirmation`
- Uses `startOrderUpdates` (SSE + polling fallback)
- Order detail panel: status, filled/unfilled, failure reason, "Ask AI" prompt
- Note: "Legacy synchronous trades appear in Transaction History, outside this order list"

### OverviewDashboard.tsx (`"use client"`)
- Uses `usePortfolioData(true)`
- Metrics: Total Portfolio Value, Available Cash, Invested Amount, Unrealized P&L (with positive/negative accent)
- `PortfolioPerformanceChart` with ready state
- Portfolio Snapshot: assets count, market valuation (live vs reference)
- Disclaimer: "Unrealized P&L reflects simulated valuations. Orders execute at backend reference prices."

### PortfolioHoldings.tsx
- Holdings table with symbol, name, quantity, price, market value, unrealized P&L
- Trade action per holding (holdingTradeRequest passed to TradeForm)

### PortfolioIntelligence.tsx
- Performance chart and attribution table
- Rebalancing planner with target allocation inputs
- Reads from `/api/portfolio/intelligence`

### AssetCatalog.tsx
- Lists all assets with symbol, name, price, currency
- Links to research and alerts

### LiveMarketPrices.tsx / MarketPriceProvider.tsx
- WebSocket connection to `ws://localhost:8081/ws/prices` (via Next.js API proxy `/api/market/prices`)
- Maintains price map; provides `useMarketPrices()` hook returning `{prices, status}` (connected/reconnecting)

### ResearchTerminal.tsx
- Candlestick/line chart with Recharts
- Playback controls: start/pause/resume/reset replay
- Range selection, period selection, tooltip/volume
- Research context sharing via `research.ts`

### RiskLab.tsx
- Broad shock and per-asset shock inputs (-100% to +100%)
- Position table with projected values and impacts
- Metrics: volatility, max drawdown, correlations, HHI, effective positions
- Warnings for missing data, multi-currency, insufficient history

### NotificationCenter.tsx / NotificationBell.tsx / NotificationPreferences.tsx
- Notification list with read/unread toggle
- Preferences UI for all 8 event types
- Unread count badge

### ActivityHistory.tsx / ActivityTimeline.tsx
- Activity union view (orders, transactions, dividends, legacy orders)
- Pagination by cursor (occurredAt, key)

### DividendAgent.tsx / BonusAgent.tsx / BusinessRulesAgent.tsx
- Read-only simulation forms
- Calls Next.js API proxy routes → AI service → backend
- Results displayed with disclaimers

### DeveloperStudio.tsx
- Integrated with `/developer` route
- Explorer, session management, approvals, commit/push, CI interface
- Uses `developer-session.ts` and `developer-studio.ts` libraries

### AppShell.tsx
- Theme, navigation, CSS variables
- Layout shell for all pages

## 6. Supporting Components

| Component | Purpose |
|-----------|---------|
| `NotificationPreferences.tsx` | Notification event type toggles |
| `orderAssessment.ts` | Order validation assessment logic |
| `portfolioValuation.ts` | Portfolio valuation calculations |
| `portfolio-shell.css` | Component-scoped CSS |
| `intelligence.css` | Intelligence page styles |

## 7. Frontend Test Suites

| Test File | Milestone | Coverage |
|-----------|-----------|----------|
| `tests/m34.test.mjs` | M34 | Route contracts, validation, submission, cancellation, polling |
| `tests/m35-m37.test.mjs` | M35-M37 | Limits, reservations, lifecycle streaming |
| `tests/m38-m40.test.mjs` | M38-M40 | Research, risk lab, AI copilot |
| `tests/m41-m43.test.mjs` | M41-M43 | Notifications, activity, preferences |
| `tests/m44-m46.test.mjs` | M44-M46 | Performance, attribution, rebalancing |
| `tests/m47-m49.test.mjs` | M47-M49 | Developer Studio |

**Verification:** `npm.cmd run lint` (zero errors/warnings after M50), `npx.cmd tsc --noEmit`, `npm.cmd run build` (39 pages), 57 total frontend tests passed.

### oms-proxy.ts
- `listOrdersProxy()` — GET list; `submitOrderProxy(request)` — POST with validation; `orderProxy(rawId, cancel)` — GET detail or POST cancel
- Forwards to `http://localhost:8080/api/portfolios/1/simulated-orders`
- Error mapping: 404 → "Order or portfolio not found.", 409 → "Order is already terminal.", 5xx → "OMS unavailable. A submitted action may already have completed."

### order-polling.ts
- `startOrderPolling(options)` — serial bounded loop: no overlapping requests, max 100 requests, max 3 errors, 3s interval
- `PollOptions` — read, initial, onSnapshot, onPortfolioChange, onError, onPaused, intervalMs, maxRequests, maxErrors
- Detects status/filledQuantity changes → triggers portfolio refresh

### order-updates.ts
- `startOrderUpdates(options, create)` — SSE EventSource to `/api/portfolio/simulated-orders/events`
- On "reset" → full refresh; on "order" event → validates eventId > last, triggers refresh
- On error → falls back to polling (5s interval, max 60 requests)
- Events invalidate HTTP evidence; never invent balances/fills from events

### notification-updates.ts
- `startNotificationUpdates(refresh, create)` — SSE listener for "reset" and "notification" events; debounced refresh (100ms)

### research.ts
- `ResearchContext`, `Bar`, `Research` types
- `getResearchContext()` / `publishResearchContext(context)` — window event-based context sharing
- `replayNext(index, length)` — playback navigation; `dateRange(days, today)` — UTC date range

### usePortfolioData.ts
- Portfolio data hook used by OverviewDashboard and components
- `cancelWithConfirmation(order, confirm, send)` — confirmation gate
- `readOrders(signal, tracked, selectedId)` — fetches list, tracks active orders outside latest 100, fetches details individually
- `submitSimulatedOrder(input)` — submits, validates response matches input
- `cancelSimulatedOrder(id)` — cancels, handles 409 (already terminal)