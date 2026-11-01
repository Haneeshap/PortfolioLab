# DOCUMENTATION 10 — Milestones & Release Notes (M31–M53)

## 1. M31 — Simulated Orders (OMS Phase 1)
**Feature:** Durable simulated order lifecycle (SUBMITTED → ACCEPTED → PARTIALLY_FILLED → FILLED/REJECTED/CANCELLED)
**Database:** V16 (`simulated_orders`, `simulated_order_fills`)
**Key classes:** `SimulatedOrderService`, `SimulatedOrderController`, `OrderConditions`
**Behavior:** Orders tracked separately from legacy trades; OrderView includes status, filled quantity, failureReason; list limited to latest 100; no idempotency key.

## 2. M32 — Execution Receipts
**Feature:** One transaction per simulated fill; execution receipts
**Database:** V17 (`simulated_exchange_executions`)
**Key class:** `ReconciliationService`
**Behavior:** Links order → execution → transaction; receipt is evidence not another cash flow; reconciliation checks internal consistency.

## 3. M33 — AI Agents
**Feature:** Ask AI with Dividend, Bonus, Business Rules agents
**Sibling repo:** `portfoliolab-ai/`
**Key files:** `server.ts`, `mcp-client.ts`, `mcp-server.ts`, `order-intelligence.ts`
**Behavior:** MCP stdio server exposes 7 read-only tools; Ollama qwen2.5:0.5b for explanations; all agents read-only, no trading authority.

## 4. M34 — Trading UI + Async OMS
**Feature:** Next.js UI for M31 orders with Recent Orders, polling, cancellation
**Key files:** `TradeForm.tsx`, `RecentOrders.tsx`, `simulated-orders.ts`, `oms-proxy.ts`
**Behavior:** Serial polling (3s gap, max 100 rounds, max 3 failures); cancel with browser confirmation; cancellation cannot reverse fills.

## 5. M35–M37 — Limits, Reservations, Lifecycle Streaming
**Database:** V18 (order_type, limit_price, time_in_force, expires_at, EXPIRED), V19 (reservations), V20 (order events + trigger)
**Key classes:** `OrderConditions`, `OrderReservations`, `OrderEventStream`, `SimulatedExchangeWorker`
**Behavior:** LIMIT requires positive price ≤ 4 decimals; DAY ends at midnight Asia/Kolkata; BUY reserves qty×ceil4(limit×FX×1.05); SSE at `/api/portfolios/1/simulated-orders/events` (portfolio 1 only, max 100 clients).

## 6. M38–M40 — Research Terminal + Risk Lab + AI Copilot
**Database:** V21 (`fictional_market_candles`)
**Key classes:** `ResearchService`, `ResearchMath`, `ResearchHistoryStore`, `RiskLabService`
**Behavior:** Go simulator `/history` generates deterministic fictional candles (anchor 2025-01-01, max 366 days); indicators SMA/EMA/RSI/volatility; Risk Lab portfolio 1 only with broad/asset shocks; HHI, effective positions, volatility, drawdown; historical metrics need 90 days aligned history, max 25 positions.

## 7. M41–M43 — Notifications, Activity Timeline, Preferences
**Database:** V22 (`notification_preferences`, `notification_receipts`, order notification trigger)
**Key classes:** `NotificationController`, `NotificationEventConsumer`, `NotificationOutboxPublisher`, `ActivityController`
**Behavior:** V22 trigger enqueues notifications for FILLED/PARTIALLY_FILLED/CANCELLED/EXPIRED; Kafka outbox publisher (max 25 events, acks=all); consumer dedup via receipts; 8 preference types default enabled; 90-day retention; activity UNION of orders/transactions/dividends/legacy.

## 8. M44–M46 — Portfolio Intelligence (Performance + Attribution + Planner)
**Database:** V23 (referenced; not present in repository)
**Key classes:** `PerformanceAccounting`, `PortfolioIntelligenceService`
**Behavior:** Performance reads persisted observations; periods 7D/1M/3M/ALL; return % = 100×(ending−starting)/starting; attribution per asset; rebalancing planner with whole shares, 5% cash buffer, sale proceeds excluded from buy budget; hypothetical only.

## 9. M47–M49 — Developer Studio
**Feature:** Local developer workspace at `/developer`; Git inspection, diffs, staging, commits, pushes, CI runs
**Component:** `services/developer-agent/` (Node.js/TypeScript, port 4317)
**Behavior:** Origin restricted to localhost:3000; CSRF tokens; 2-minute bootstrap; 30-minute sessions; no hooks/GPG/force push; optional GitHub PAT; optional Ollama analysis.

## 10. M50–M53 — Stabilization (October 17, 2026)
**Outcome:** All test suites pass, production builds pass, real-service flow checks pass
- **M50:** Frontend ESLint 20 errors+3 warnings → zero; fixes for effect state, render clocks, apostrophes, unused values
- **M51:** Isolated test databases (`m50_tests_20261017`, `m50_runtime_20261017`); UTC startup fix
- **M52:** Real-service flow (Next+Spring+PostgreSQL+Kafka+Go); browser checks
- **M53:** AI/MCP evidence verified against running application

**Verification Results:** Frontend 57 tests + build (39 pages); Backend 144 tests zero failures; Go 4 tests + vet; AI 73 tests + typecheck; Developer Agent 20 tests + typecheck.

**Release Status:** Not ready for unconditional main-branch release (main 21 ahead, 1 behind origin/main; AI checkout has local revisions).

## 11. Known Pre-Existing Issues
- Historical order #2: `INVALID_UNFILLED_STATUS` (REJECTED, filled 3/4, "Order total exceeds supported precision")
- No clean database dump for reconciliation SQL integration test
- No application Dockerfiles; native services in separate terminals
- `.env` plaintext; historical credentials may exist in Git history
- No authentication, TLS, multi-user ownership, production security