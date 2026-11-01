# PortfolioLab Simulated Trading Logic

*Engine runs inside the FastAPI backend; order fill decisions use the Go market simulator (`127.0.0.1:8081/prices`). All cash/shares reservations are tracked in the `ReservationManager`.*

## Order‑fill flow

1. **Order creation** (`POST /api/simulated-orders`)
   - Backend validates side (`BUY`/`SELL`), type (`MARKET`/`LIMIT`), and required fields.
   - For **BUY** orders: `ReservationManager.reserve_cash(portfolio_id, limit_price)` is called.
   - For **SELL** orders: `ReservationManager.reserve_shares(portfolio_id, symbol, quantity)` is called.
   - A `SimulatedOrder` row is inserted with status `SUBMITTED`, then immediately transitioned to `ACCEPTED`.
   - `oms_service.create_order()` invokes the **execution engine** to simulate a fill.

2. **Execution engine** (`app/services/execution_engine.py`)
   - Calls `_get_current_price()` → `httpx.GET http://127.0.0.1:8081/prices` (timeout 2 s).
   - If the simulator returns a price, the fill proceeds; otherwise the order is **REJECTED** with reason `no_price_available`.
   - **MARKET orders**: always fill at the current price, status → `FILLED`.
   - **LIMIT orders**:
     - **BUY** limit fills when `current_price ≤ limit_price` → status `FILLED`, fill price = `limit_price`.
     - **SELL** limit fills when `current_price ≥ limit_price` → status `FILLED`, fill price = `limit_price`.
     - If the price condition is not met, status becomes `PARTIALLY_FILLED` (or remains `SUBMITTED` until expiry).
   - After determining fill, the engine updates the `SimulatedOrder` status and fields (`filled_quantity`, `avg_fill_price`) via the session.

3. **Reservation handling** (`app/services/reservation_manager.py`)
   - `reserve_cash(portfolio_id, amount)` adds `amount` to `portfolio.reserved_cash` in the DB.
   - `reserve_shares(portfolio_id, symbol, quantity)` increments `portfolio.reserved_shares[symbol]`.
   - On order cancel or partial fill, the corresponding `release_cash` / `release_shares` methods decrement the reservations.
   - Reservations ensure a user cannot overallocate cash or shares beyond available balance.

4. **Order status lifecycle**
   - `SUBMITTED` → `ACCEPTED` (immediate)
   - `ACCEPTED` → `FILLED` (market) or `PARTIALLY_FILLED`/`REJECTED` (limit)
   - `FILLED`/`REJECTED`/`CANCELLED`/`EXPIRED` are **terminal** states; further status updates are ignored.
   - If an order expires (`expires_at` passed without fill), status becomes `EXPIRED`.

5. **Kafka event emission** (`app/services/oms_service.py`)
   - On order creation: produce `ORDER_PLACED` event to topic `oms.order.lifecycle.events`.
   - On fill: produce `ORDER_FILLED` event (includes `order_uid`, `filled_quantity`, `avg_fill_price`).
   - On reject/cancel: produce `ORDER_REJECTED` or `ORDER_CANCELLED` events.
   - Events are consumed by the notification worker, which creates UI notifications and persists outbox entries.

6. **P&L calculation** (used by portfolio performance endpoint)
   - For each holding: `market_value = quantity × current_price`, `cost_basis = quantity × average_buy_price`, `pnl = market_value - cost_basis`, `pnl_pct = pnl / cost_basis × 100`.
   - If no live price exists, the average buy price is used as fallback.
   - Total portfolio P&L = `total_market_value - total_cost_basis`; `portfolio_pnl_pct = total_pnl / total_cost_basis × 100`.

## Key formulas

| Concept | Formula |
|---|---|
| **Market fill price** | `fill_price = current_price` (from Go simulator) |
| **LIMIT BUY fill** | `if current_price ≤ limit_price → fill_price = limit_price` |
| **LIMIT SELL fill** | `if current_price ≥ limit_price → fill_price = limit_price` |
| **Cash reserved** | `reserved_cash += limit_price × quantity` (for a BUY LIMIT) |
| **Shares reserved** | `reserved_shares[symbol] += quantity` (for a SELL) |
| **P&L per holding** | `pnl = (current_price - average_buy_price) × quantity` |
| **P&L percentage** | `pnl_pct = pnl / (average_buy_price × quantity) × 100` |
| **Herfindahl‑Hirschman Index (HHI)** | `HHI = Σ (market_share_i²) × 10 000` where `market_share_i = market_value_i / total_market_value` |
| **Annualised volatility** | `σ_annual = stddev(log‑returns) × √252` |
| **Max draw‑down** | `max_dd = max_{t} (peak_t – price_t) / peak_t`, where `peak_t` is the highest price seen up to `t` |

## Decision diagram (textual)

```
order created
   |
   v
validate side & type
   |
   v
if SELL → reserve_shares
     else BUY → reserve_cash
   |
   v
execution_engine._get_current_price()
   |
   v
price available?
   |-- no --> order.status = REJECTED, produce ORDER_REJECTED event
   |-- yes
        |
        v
if order_type == MARKET
        |
        v
order.status = FILLED, fill_price = current_price
        |
        v
else (LIMIT)
        |
        v
if side == BUY and current_price ≤ limit_price
        → fill_price = limit_price, status = FILLED
else if side == SELL and current_price ≥ limit_price
        → fill_price = limit_price, status = FILLED
else
        → status = PARTIALLY_FILLED (or SUBMITTED if not expired)
        fill_price = None
        |
        v
produce fill event (ORDER_FILLED / ORDER_REJECTED)
        |
        v
update Reservations (release if cancel/partial)
```

*All logic is synchronously executed within the request‑response cycle; no background workers are required for basic order fill.*

---
*Logic overview generated from code‑base inspection on 2026‑10‑27.*