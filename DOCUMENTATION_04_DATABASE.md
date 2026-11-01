# DOCUMENTATION 04 — Database Schema Deep Dive (Flyway Migrations V1–V23)

## 1. Overview

- **Database:** PostgreSQL 17
- **Migration tool:** Flyway (V1–V23, applied automatically on backend startup)
- **Hibernate:** `ddl-auto=validate` (schema must exactly match; no auto-creation)
- **Timezone:** Database session uses `Etc/UTC`; backend forces JVM UTC
- **Seeded data:** 5 assets (V2), 1 demo portfolio with 100000 INR cash (V4), FX rates USD→INR 85.0, EUR→INR 92.0 (V6)

## 2. Migration Summary

| Version | Description | Key Tables/Changes |
|---------|-------------|-------------------|
| V1 | Create assets table | `assets` |
| V2 | Seed demo assets | 5 assets: DEMO, NOVA, GREEN, ORBIT, ALPHA |
| V3 | Create portfolio tables | `portfolios`, `holdings`, `transactions` |
| V4 | Seed demo portfolio | Portfolio ID 1, 100000 INR |
| V5 | Create portfolio snapshots | `portfolio_snapshots` |
| V6 | Create FX rates | `fx_rates` (USD→INR 85, EUR→INR 92) |
| V7 | Add transaction FX execution | `execution_fx_rate`, `portfolio_amount` columns |
| V8 | Add holding historical cost | `historical_cost_portfolio` column + backfill procedure |
| V9 | Create notification infrastructure | `notification_outbox`, `notifications` |
| V10 | Portfolio events | `simulated_dividend_payments`, `portfolio_risk_insights` |
| V11 | Scheduled dividends | `simulated_dividend_schedules`, `simulated_scheduled_dividend_payments` |
| V12 | Market price alerts | `market_price_alerts` |
| V13 | Watchlists + stock universe | `watchlists`, `watchlist_items`, 20 sector assets |
| V14 | Market intelligence | `market_price_samples`, `market_intelligence_events`, `market_intelligence_outbox` |
| V15 | Pre-trade risk policies | `pre_trade_risk_policies` (max_order_value 50000, max_position_pct 100) |
| V16 | Simulated order lifecycle | `simulated_orders`, `simulated_order_fills` |
| V17 | Simulated exchange executions | `simulated_exchange_executions` (receipts) |
| V18 | Limit orders | `order_type`, `limit_price`, `time_in_force`, `expires_at`, EXPIRED status |
| V19 | Order reservations | `reservation_managed`, `reserved_cash`, `reserved_shares`, `cash_per_share` |
| V20 | Order lifecycle events | `simulated_order_events`, trigger `record_simulated_order_event()` |
| V21 | Fictional market history | `fictional_market_candles` (OHLCV, source='fictional-history-v1') |
| V22 | Notification experience | `notification_preferences`, `notification_receipts`, order notification trigger |
| V23 | Verified portfolio observation | (referenced in docs; migration file not present in repository) |

## 5. OMS Tables (V16–V20)

### simulated_orders (V16, V18, V19)
```sql
simulated_orders (id, portfolio_id, asset_id, side, requested_quantity,
  filled_quantity, status, failure_reason, created_at, updated_at,
  order_type DEFAULT 'MARKET', limit_price, time_in_force DEFAULT 'GTC',
  expires_at, reservation_managed DEFAULT FALSE,
  reserved_cash DEFAULT 0, reserved_shares DEFAULT 0, cash_per_share DEFAULT 0)
```
Statuses: SUBMITTED, ACCEPTED, PARTIALLY_FILLED, FILLED, REJECTED, CANCELLED, EXPIRED (V18)
Checks: filled <= requested; FILLED requires filled=requested; PARTIALLY_FILLED requires 0<filled<requested
V18 adds order_type (MARKET/LIMIT), limit_price, time_in_force (DAY/GTC), expires_at
V19 adds reservation_managed, reserved_cash, reserved_shares, cash_per_share (all >= 0)

### simulated_order_fills (V16)
Links each fill to a unique transaction; fill_sequence > 0; UNIQUE(order_id, fill_sequence)

### simulated_exchange_executions (V17)
Execution receipts: execution_ref (UUID-based), transaction_id unique, quantity, price_per_unit
One receipt per fill; links order → execution → transaction

### simulated_order_events (V20)
Transactional journal: portfolio_id, order_id, status, requested_quantity, filled_quantity, created_at
Trigger `record_simulated_order_event()` fires AFTER INSERT OR UPDATE on simulated_orders
Records on insert and on status/filled_quantity changes — rolled-back changes cannot be streamed

## 6. Fictional History Table (V21)

### fictional_market_candles
```sql
(asset_id, candle_time, interval_code='1d', source='fictional-history-v1',
 open, high, low, close, volume)
PRIMARY KEY(asset_id, interval_code, candle_time)
CHECK(high>=open AND high>=close AND low<=open AND low<=close AND high>=low)
CHECK(candle_time = date_trunc('day', candle_time AT TIME ZONE 'UTC') AT TIME ZONE 'UTC')
```
Comment: "Generated fictional-history-v1 fixtures, not recorded market history or live OMS quotes"
Ingested on-demand from Go simulator `/history` endpoint; ON CONFLICT DO NOTHING

## 7. Notification Tables (V22)

### notification_preferences
portfolio_id + event_type PK; 8 types: ORDER_FILLED, ORDER_PARTIALLY_FILLED, ORDER_CANCELLED, ORDER_EXPIRED, PRICE_ALERT, TRADE_EXECUTED, DIVIDEND_CREDITED, AGENT_INSIGHT; enabled DEFAULT TRUE

### notification_receipts
event_id UUID PK for deduplication; seeded from existing notification event_ids

### order_notification trigger (V22)
AFTER INSERT on simulated_order_events; only FILLED/PARTIALLY_FILLED/CANCELLED/EXPIRED statuses
Generates UUID from md5('order-event:' || order id); inserts into notification_outbox with ORDER_ status type
No historical backfill — only future events

## 8. Constraints & Validation Rules

- **Monetary precision:** NUMERIC(19,4) for cash/amounts; NUMERIC(19,8) for FX rates
- **Quantity precision:** NUMERIC(19,6) for share quantities
- **Non-negative:** cash_balance, reserved_cash, reserved_shares, historical_cost_portfolio
- **Positive:** prices, rates, quantities, dividend amounts
- **Currency format:** `^[A-Z]{3}$` regex on all currency columns
- **FX:** base != quote, rate > 0
- **Alert:** TRIGGERED status requires triggered_at (and vice versa)
- **Dividend idempotency:** UNIQUE (portfolio_id, reference_key) on payments
- **Candle OHLC:** high >= open/close, low <= open/close, high >= low
- **Candle time:** UTC midnight truncation enforced
- **Order status/quantity:** filled <= requested; terminal states have matching fill quantities

## 9. Indexes

| Table | Index | Purpose |
|-------|-------|---------|
| assets | (symbol) unique | Fast symbol lookup |
| holdings | (portfolio_id) | Portfolio holdings |
| transactions | (portfolio_id, created_at DESC) | History pagination |
| portfolio_snapshots | (portfolio_id, captured_at DESC, id DESC) | History chart |
| fx_rates | (base, quote, captured_at DESC, id DESC) | Latest rate lookup |
| notification_outbox | (created_at, event_id) WHERE published_at IS NULL | Pending publisher |
| notifications | (portfolio_id, created_at DESC, id DESC) | Notification list |
| notifications | (portfolio_id, id) WHERE read_at IS NULL | Unread count |
| market_price_samples | (symbol, observed_at DESC) | Intelligence lookups |
| simulated_orders | (portfolio_id, created_at DESC, id DESC) | Order list |
| simulated_orders | (id) WHERE status pending | Pending orders |
| simulated_order_events | (portfolio_id, id) | SSE cursor pagination |
| watchlists | (portfolio_id) | User watchlists |

## 10. Data Integrity Notes

- Receipts are evidence, not another financial cash flow
- Pending orders, cancellations, reservations are not holdings changes
- Trade cash amounts as `portfolio_amount` using execution FX; purchases decrease cash, sales increase it
- Immediate settlement on fill — no delayed receivable/payable model
- Manual and scheduled dividends have separate payment ledgers
- Scheduled payments use `credited_at` for actual income timing
- No contribution/withdrawal ledger; initial deposits cannot be reconstructed
- Fees not modeled
- Research OHLCV (fictional-history-v1) excluded from portfolio calculations
- Existing snapshots unlabeled unverified (no coherent lock, no position details)

## 3. Detailed Table Definitions (Part 1)

### assets (V1, V2, V13)
```sql
CREATE TABLE assets (
    id BIGSERIAL PRIMARY KEY,
    symbol VARCHAR(20) NOT NULL UNIQUE,
    name VARCHAR(150) NOT NULL,
    price NUMERIC(19, 4) NOT NULL CHECK (price >= 0),
    currency VARCHAR(3) NOT NULL,
    sector VARCHAR(60)
);
```
Seeded (V2): DEMO 125.50, NOVA 842.75, GREEN 315.25, ORBIT 1560.00, ALPHA 98.40 (all INR)
Additional (V13): 20 sector-classified assets in Technology, Finance, Energy, Industrial, Healthcare, Consumer sectors

### portfolios (V3, V4)
Seeded (V4): ID 1, 'Demo Portfolio', 100000.0000 INR

### holdings (V3, V8)
Includes `historical_cost_portfolio` (V8 backfill using weighted-average cost replay from transactions)

### transactions (V3, V7)
Includes `execution_fx_rate` (NUMERIC(19,8)) and `portfolio_amount` (NUMERIC(19,4)) added in V7

## 4. Detailed Table Definitions (Part 2)

### portfolio_snapshots (V5)
Recorded every 30s by `PortfolioHistoryRecorder`; marked unverified in M44-M46 (captured without coherent portfolio lock)

### fx_rates (V6)
Seeded: USD→INR=85.0 (SIMULATED), EUR→INR=92.0 (SIMULATED)

### notification_outbox / notifications (V9, V22)
Outbox stores pending events; notifications store delivered notices with read state

### simulated_dividend_payments (V10)
UNIQUE (portfolio_id, reference_key) for idempotency

### simulated_dividend_schedules / scheduled_payments (V11)
Payment must be after record cutoff; eligible shares computed from net BUY-SELL by cutoff

### market_price_alerts (V12)
Status TRIGGERED iff triggered_at is not null

### watchlists / watchlist_items (V13)
Watchlist names unique per portfolio; items link watchlists to assets

### market_price_samples / market_intelligence_events / market_intelligence_outbox (V14)
Samples pruned after 24 hours; intelligence events have 10-minute cooldown per asset/direction

### pre_trade_risk_policies (V15)
Defaults: max_order_value 50000, max_position_pct 100, enabled=true