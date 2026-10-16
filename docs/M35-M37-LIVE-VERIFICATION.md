# M35-M37 command-line live verification

Date: 2026-10-16, Asia/Calcutta (India time). Repository: `C:\Users\hello\Projects\PortfolioLab`.

**Result: database/infrastructure checks passed; HTTP trading and SSE verification are blocked by an unavailable backend.** Repeated requests to both localhost:8080 and 127.0.0.1:8080 failed to connect. No trading request was submitted, and no verification portfolio was created. Unexecuted scenarios below are explicitly unverified.

## Scope and safety

Inspected `docs/M35-M37.md`, actual OMS controllers/services, `OrderRequest`, settlement/pricing/risk implementation, V18-V20 SQL, lifecycle/SSE/reconciliation tests, application properties, Compose configuration, backend launcher, and frontend update controller before attempting verification.

Used Windows PowerShell, curl.exe, and psql/Kafka utilities inside the **existing** containers. No Next.js, Ollama, AI service, additional container, or backend process was launched. Docker access required an authorized command outside the filesystem sandbox. No application source, migration, Flyway history, balance, holding, order, or database was changed. No reset, truncation, deletion, commit, or push occurred.

## A. Live infrastructure and Flyway

| Check | Result | Evidence |
| --- | --- | --- |
| Existing PostgreSQL container | PASS | `portfoliolab-postgres`, postgres:17, running and healthy, loopback port 5432 |
| PostgreSQL connectivity | PASS | psql connected as `portfoliolab` to database `portfoliolab` |
| Existing Kafka container | PASS | `portfoliolab-kafka`, apache/kafka:3.9.1, running, loopback port 9092 |
| Kafka broker/topic listing | PASS | Existing `__consumer_offsets`, `portfoliolab.notifications.v1`, `portfoliolab.market-intelligence.v1` listed successfully |
| Simulator health | PASS | GET localhost:8081/health returned HTTP 200, `{"service":"market-simulator","status":"UP"}` |
| Actual fictional quotes | PASS | GET localhost:8081/prices returned HTTP 200 with INR assets and timestamped prices |
| Backend health | BLOCKED | curl exit 7: connection refused on localhost:8080 and 127.0.0.1:8080 |
| Running backend uses new schema | UNVERIFIED | Updated database schema exists, but no backend health/OMS response or JDBC session could be observed |
| Failed Flyway history entries | PASS | `SELECT count(*) ... WHERE NOT success` returned 0; versions 1-20 all successful |

Applied migration records, as rendered by PostgreSQL:

| Version | Description | Checksum | Success | installed_on |
| --- | --- | --- | --- | --- |
| 18 | limit orders | 851520690 | true | 2026-10-16 13:22:06.856987 |
| 19 | order reservations | -1078214632 | true | 2026-10-16 13:22:07.333573 |
| 20 | order lifecycle events | 973081666 | true | 2026-10-16 13:22:07.396466 |

These are stored history values, not a fresh Flyway validation run. Database session TimeZone is `Etc/UTC`; the backend test reports separately record Java `user.timezone=Asia/Kolkata`.

Live schema inspection confirmed:

- `simulated_orders`: order_type, limit_price NUMERIC(19,4), time_in_force, expires_at, reservation_managed, reserved_cash NUMERIC(19,4), reserved_shares NUMERIC(19,6), cash_per_share NUMERIC(19,4).
- MARKET/GTC defaults, valid LIMIT-price constraint, DAY/GTC constraint, EXPIRED status, nonnegative reservation constraints, and existing order/fill quantity constraints (16 constraints total).
- `simulated_order_events`, its primary key and `idx_order_events_portfolio_cursor` index.
- Enabled `simulated_order_event` trigger (`tgenabled=O`) and actual installed `record_simulated_order_event()` PL/pgSQL function, which records inserts and status/cumulative-fill changes.
- Zero PostgreSQL JDBC sessions in the final database-session inspection. The psql connection itself worked.

Representative read-only commands executed:

```powershell
docker compose ps
docker exec portfoliolab-postgres psql -U portfoliolab -d portfoliolab -X -c "SELECT current_database(),current_user;"
docker exec portfoliolab-postgres psql -U portfoliolab -d portfoliolab -X -c "SELECT version,description,checksum,success,installed_on FROM flyway_schema_history WHERE version IN ('18','19','20') ORDER BY installed_rank;"
docker exec portfoliolab-postgres psql -U portfoliolab -d portfoliolab -X -c "SELECT count(*) FROM flyway_schema_history WHERE NOT success;"
docker exec portfoliolab-postgres psql -U portfoliolab -d portfoliolab -X -c "SELECT tgname,tgenabled FROM pg_trigger WHERE tgrelid='simulated_orders'::regclass AND NOT tgisinternal;"
docker exec portfoliolab-kafka /opt/kafka/bin/kafka-topics.sh --bootstrap-server localhost:9092 --list
```

## Actual HTTP requests

| Actual request | Observed result |
| --- | --- |
| GET http://localhost:8081/health | HTTP 200, simulator UP |
| GET http://localhost:8081/prices | HTTP 200, actual simulated quote array |
| GET http://localhost:8080/api/health, repeated | No HTTP response; curl exit 7, diagnostic status `000` |
| GET http://127.0.0.1:8080/api/health | No HTTP response; curl exit 7, diagnostic status `000` |
| GET http://localhost:8080/api/portfolios/1/simulated-orders/events | No HTTP response; curl exit 7, diagnostic status `000`; no events received |

`000` is curl's diagnostic output when no response is received; it is not a server HTTP status. Example commands:

```powershell
curl.exe -sS --max-time 10 -w '\nHTTP %{http_code}\n' http://localhost:8080/api/health
curl.exe -sS --max-time 10 -w '\nHTTP %{http_code}\n' http://127.0.0.1:8080/api/health
curl.exe -sS --max-time 10 -w '\nHTTP %{http_code}\n' http://localhost:8081/health
curl.exe -sS --max-time 10 -w '\nHTTP %{http_code}\n' http://localhost:8081/prices
```

Observed quote examples from response timestamp `2026-10-16T08:20:28.2659325Z`: ALPHA INR 100.31938612523881; DEMO INR 124.0996529548358; GREEN INR 327.48772032093433. Prices were read from the local Go simulator, without external market or FX requests.

## B. LIMIT orders and C. reservations

Live starting demo portfolio, read directly from PostgreSQL:

- Portfolio 1, Demo Portfolio, INR cash **7726.8263**.
- Total reserved cash **0.0000**. Database-derived available buying power therefore **7726.8263**; the availability HTTP endpoint was not verified.
- Holdings: DEMO 76 shares, GREEN 14, ORBIT 50, ALPHA 10. These are existing fictional holdings, not verification trades.
- No other portfolio existed at inspection time.

| Scenario | Live result | Separate automated evidence |
| --- | --- | --- |
| Below-price LIMIT stays pending without fills | UNVERIFIED: backend unavailable | Existing passing crossing/recrossing integration test |
| LIMIT type/price/TIF persisted through HTTP | UNVERIFIED | Source/schema inspected; passing lifecycle integration tests |
| Pending cancellation restores buying power | UNVERIFIED | Existing passing partial cancellation/reservation tests |
| Eligible LIMIT execution | UNVERIFIED | Existing passing LIMIT/MARKET integration test |
| MARKET regression | UNVERIFIED for a new live request | Existing passing settlement and lifecycle tests |
| DAY/GTC request/response behavior | UNVERIFIED live | Passing condition and expiration integration tests; code uses next Asia/Kolkata midnight for DAY, null expiration for GTC |
| Competing BUY reservations | UNVERIFIED live | Existing passing concurrent BUY integration test |
| SELL reservations/overselling protection | UNVERIFIED live | Existing passing concurrent SELL and partial SELL/cancellation tests |
| Partial fills and unused-reservation release | UNVERIFIED live | Existing passing partial BUY/SELL integration tests |
| No double cash/holding deduction on new trades | UNVERIFIED live | Existing passing settlement/idempotence/accounting tests |

No synthetic live order, expiration update, historical change, or balance adjustment was used to manufacture evidence. Natural midnight expiration and random price crossing were not awaited.

## D. SSE

Implementation discovery (source evidence, not live transport evidence):

- Direct Spring endpoint: `GET /api/portfolios/1/simulated-orders/events`, producing `text/event-stream`.
- No authentication is implemented for this local single-user demo. Subscriptions for portfolio IDs other than 1 are rejected with 404 in the implementation.
- Initial `reset`, `order` events with SSE `id` and JSON eventId/portfolioId/orderId/status/requestedQuantity/filledQuantity, heartbeat comments, Last-Event-ID replay, and two-minute connection lifetime are implemented.
- Next proxy exists at `/api/portfolio/simulated-orders/events`; Next was intentionally not launched.

**Live connection, order-triggered delivery, wire event IDs, portfolio isolation, replay and clean stream disconnection are UNVERIFIED.** A bounded curl SSE connection attempt failed with exit 7 and no HTTP response; the client exited and received no events. Existing MockMvc tests cover emission/cursor/scoping; the nine frontend unit tests run during this verification cover duplicate handling, reconnection/reset, cleanup and HTTP refresh behavior. Those are automated-test evidence, not live transport or visual React evidence.

## E. OMS, settlement and reconciliation

Recent persisted orders, inspected read-only:

| Order | Portfolio/asset | Side | Requested | Filled | Status | Reserved cash/shares |
| --- | --- | --- | --- | --- | --- | --- |
| 4 | 1 / GREEN | BUY | 1 | 1 | FILLED | 0 / 0 |
| 3 | 1 / GREEN | BUY | 1 | 1 | FILLED | 0 / 0 |
| 2 | 1 / DEMO | BUY | 4 | 3 | REJECTED | 0 / 0 |
| 1 | 1 / DEMO | BUY | 2 | 0 | CANCELLED | 0 / 0 |

Existing execution receipts inspected: order 2 sequences 1/2 link transactions 10/11, quantities 2/1, prices 186.1280/185.0848; orders 3/4 link transactions 12/13, quantity 1 each, prices 316.1496/314.6506. No new settlement was generated.

Executed the exact read-only reconciliation CTE extracted from the inspected service, substituting portfolio ID 1 for its JDBC parameter. It returned:

```text
order 1: no exception
order 2: INVALID_UNFILLED_STATUS
order 3: no exception
order 4: no exception
```

Order #2 is a **pre-existing historical exception**: REJECTED with requested quantity 4 and cumulative filled quantity 3. Its stored failure reason is `Order total exceeds supported precision`; it predates V18-V20 and is reservation_managed=false. Reconciliation gives historical execution/settlement mismatches precedence, so the returned status exception also indicates those earlier consistency checks did not identify a mismatch for this order. It was preserved exactly.

The independent terminal-reservation-leak query returned **0** across the database. Before/after database fingerprints matched for historical orders 1-4, transactions 1-13, and all demo holdings. There are no newly created verification orders to reconcile; a claim that new orders are clean would be unexecuted evidence.

## Automated evidence, kept separate

Inspected current-date Maven Surefire XML reports: **82 tests, 0 errors, 0 failures** across 23 suites. The lifecycle report records `user.timezone=Asia/Kolkata` and all nine scenarios passing. An older `TemporaryFlywayRepairTest` artifact dated October 13 was excluded from this current-run count; no repair test was executed.

The nine existing lifecycle tests cover price crossing/recrossing, partial BUY cancellation/accounting, eligible LIMIT/MARKET completion, expiration preserving earlier fills, concurrent BUY/SELL reservations, SELL release, reconciliation corruption detection, permanent-rejection release, and journal rollback/replay. Existing `ReconciliationSqlIntegrationTests` also passed in those stored reports. Maven was **not rerun**, avoiding an additional heavyweight Spring context on the constrained laptop.

Executed during this verification:

```powershell
# frontend directory; no Next.js server launched
npm.cmd run test:m35-m37
```

Result: **9 passed, 0 failed**. These tests use mocked transports/static rendering and do not prove a running SSE server, Next proxy or browser UI. React UI was not visually verified.

## Defects and commit readiness

- No new application defect was established by executed live checks.
- Backend unavailability is a verified environment blocker, not proof of an OMS defect. The user indicated they would start it; subsequent bounded health probes continued to refuse connections at the time of this report.
- Historical order #2 remains a known reconciliation exception and must not be silently rewritten.
- **Commit readiness: automated and database evidence are positive, but comprehensive live sign-off is not complete.** Resume the HTTP/SSE checks once backend health returns 200 before treating M35-M37 as fully live-verified. This report does not override the earlier documented lint baseline.

To resume, use the inspected request contract and commands in `docs/M35-M37.md`, choosing a new isolated INR verification portfolio for settlement tests. The direct Spring SSE endpoint should be used while Next remains off. Preserve demo history and separately report order #2. A bounded PowerShell verification helper was prepared in the OS temporary directory but was not executed because the backend prerequisite did not become available; preparation is not verification evidence.
