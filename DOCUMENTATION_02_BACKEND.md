# DOCUMENTATION 02 — Backend Deep Dive (Spring Boot / Java 21)

## 1. Overview

- **Framework:** Java 21, Spring Boot 4.1.1 (WebMVC, Data JPA), Spring Kafka, Flyway, PostgreSQL JDBC
- **Build:** Maven wrapper 3.10.0, `pom.xml`
- **Entry point:** `BackendApplication.java` — sets JVM timezone to UTC, runs SpringApplication
- **Health:** `HealthController.java` — `GET /api/health` returns `{"status":"UP","application":"PortfolioLab"}`
- **Database validation:** Hibernate `ddl-auto=validate` (schema must match Flyway migrations exactly)
- **Open-in-view:** Disabled (`spring.jpa.open-in-view=false`)
- **Configuration:** `application.properties` — datasource `jdbc:postgresql://localhost:5432/portfoliolab`, user `portfoliolab`, password from `DB_PASSWORD` env (default `local_dev_password`), Kafka bootstrap `localhost:9092`, consumer group `portfoliolab-notifications-v1`, record ack mode, auto-commit disabled

## 2. Domain Package Inventory (13 packages)

| Package | Responsibility | Key Classes |
|---------|---------------|-------------|
| `asset` | Asset catalog CRUD | Asset, AssetRepository, AssetService, AssetController, AssetResponse |
| `portfolio` | Portfolio, holdings, transactions, order DTOs, performance accounting, intelligence | Portfolio, PortfolioRepository, PortfolioService, PortfolioController, PortfolioResponse, HoldingResponse, OrderRequest, OrderResponse, Transaction, TransactionRepository, TransactionResponse, PerformanceAccounting, PortfolioIntelligenceService, PortfolioIntelligenceController |
| `oms` | Order Management System | SimulatedOrderService, SimulatedOrderController, OrderReservations, OrderConditions, OrderEventStream, SimulatedExchangeWorker, ReconciliationService |
| `fx` | FX conversion, attribution, reference rates | FxController, FxConversionService, FxConversionResponse, FxRate, FxRateRepository, FrankfurterRateController, FrankfurterRateService, FxAttributionController, FxAttributionRequest, FxAttributionService |
| `dividend` | Dividend simulation, credit, scheduling | DividendController, DividendSimulationService, DividendCreditService, DividendCreditController, DividendCreditRequest, ScheduledDividendService, ScheduledDividendScheduler, ScheduledDividendController, DividendSchedulingConfig |
| `market` | Market prices, intelligence, price alerts | MarketController, MarketService, MarketPrice, MarketServiceUnavailableException, MarketIntelligenceController, MarketIntelligenceService, PriceAlertController, PriceAlertService |
| `notification` | Notifications, outbox, preferences, retention, activity | NotificationController, NotificationEventConsumer, NotificationKafkaConfig, NotificationOutbox, NotificationOutboxPublisher, NotificationPreferences, NotificationRetention, ActivityController, MarketIntelligenceOutboxPublisher, NotificationJacksonConfig, PortfolioEventOutbox, PreTradeRiskService, PreTradeRiskController |
| `research` | Fictional history, indicators, risk lab | ResearchController, ResearchService, ResearchMath, ResearchHistoryStore, RiskLabController, RiskLabService |
| `risk` | Pre-trade risk policies (in notification package) | PreTradeRiskService, PreTradeRiskController |
| `watchlist` | Watchlists and items | WatchlistController |
| `history` | Portfolio snapshots/history | PortfolioHistoryController, PortfolioHistoryRecorder |
| `businessrules` | Market rule evaluation | MarketRulesController, MarketRulesRequest, MarketRulesService |
| `bonus` | Bonus share simulations | BonusController, BonusSimulationService, BonusSimulationRequest, BonusSimulationResponse |

## 3. BackendApplication.java

```java
package com.portfoliolab.backend;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class BackendApplication {
    public static void main(String[] args) {
        java.util.TimeZone.setDefault(java.util.TimeZone.getTimeZone("UTC"));
        SpringApplication.run(BackendApplication.class, args);
    }
}
```

- `@EnableScheduling` enables `@Scheduled` methods (exchange worker, price alerts, intelligence observation, dividend scheduler, snapshot recorder, notification publisher, retention pruning)
- UTC timezone forced to prevent PostgreSQL rejecting Windows/JVM legacy aliases like `Asia/Calcutta`

## 4. HealthController.java

Simple health check: `GET /api/health` → `Map.of("status", "UP", "application", "PortfolioLab")`. No database connectivity check.

## 5. Asset Package

### Asset.java (Entity)
- Table: `assets`; fields: id (BIGSERIAL PK), symbol (VARCHAR(20) unique), name (VARCHAR(150)), price (NUMERIC(19,4)), currency (VARCHAR(3))
- Constructor: `Asset(String symbol, String name, BigDecimal price, String currency)`

### AssetRepository.java
- Extends `JpaRepository<Asset, Long>`; `Optional<Asset> findBySymbol(String symbol)`

### AssetService.java
- `getAllAssets()` → `List<AssetResponse>` sorted by symbol ASC

### AssetController.java
- `GET /api/assets` → `List<AssetResponse>`

### AssetResponse.java (record)
- Fields: id, symbol, name, price, currency; static factory `from(Asset asset)`

## 12. Research Package

### ResearchController.java
- `GET /api/research/assets/{assetId}/history?from=&to=&period=14` → `ResearchService.Result`

### ResearchService.java
- `validateRange(LocalDate from, LocalDate to)` — from >= 2025-01-01, to > from, to <= today UTC, max 366 days
- `research(long id, LocalDate from, LocalDate to, int period)` — period 2..100
  - Reads `fictional_market_candles` cache via `ResearchHistoryStore`
  - If missing, ingests from Go simulator `GET /history`
  - Calculates indicators via `ResearchMath.indicators(contiguous, period)`
  - Warnings for incomplete history; indicator warm-up restarts after gaps
- `Result` record: assetId, symbol, currency, source ("fictional-history-v1"), interval ("1d"), from, to, period, expectedDays, missingDays, warnings, bars, summary, methodology
- `Bar(candle, indicators)` and `Summary(firstClose, lastClose, change, changePct, observations)`

### ResearchMath.java
- `indicators(List<Double> prices, int period)` — SMA, EMA (alpha=2/(period+1)), RSI (Wilder's, flat=50), realized volatility (sample SD of log returns × sqrt(365) × 100), change, changePct
- `standardDeviation(List<Double>)` — sample SD
- `correlation(List<Double>a, List<Double>b)` — Pearson correlation, null if < 20 observations or zero variance
- `maxDrawdown(List<Double> values)` — peak-to-trough drawdown percentage

### ResearchHistoryStore.java
- `Candle(time, open, high, low, close, volume)` and `Fixture(symbol, source, interval, candles)`
- `read(long assetId, LocalDate from, LocalDate to)` — SELECT FROM fictional_market_candles WHERE asset_id=? AND interval_code='1d' AND candle_time >= from AND < to ORDER BY candle_time LIMIT 366
- `ingest(long assetId, String symbol, LocalDate from, LocalDate to)` — fetches Fixture from Go `/history`, validates source="fictional-history-v1", interval="1d", candle count matches expected days, validates OHLC invariants, INSERT ON CONFLICT DO NOTHING
- RestClient to `http://127.0.0.1:8081` with 3s connect / 5s read timeout

### RiskLabController.java
- `GET /api/portfolios/{portfolioId}/risk-lab` → exposure evaluation
- `POST /api/portfolios/{portfolioId}/risk-lab/scenario` → scenario evaluation

### RiskLabService.java
- `evaluate(long portfolioId, Scenario requested)` — only portfolio 1 allowed
- `Scenario(broadShockPct, assetShocks)` — shocks -100 to +100, max 4 decimals, max 100 asset shocks
- `Result` record: portfolioId, currency, cash, marketValue, projectedValue, absoluteChange, percentageChange, cashAllocationPct, largestPositionPct, assetHhi, effectivePositions, unrealizedGainLoss, positions, metrics, warnings, scenario, hypothetical, sectorsSupported, methodology
- `metrics(Portfolio, List<HoldingResponse>)` — requires 90 days of aligned fixture history for all holdings, max 25 positions, same currency; returns volatility (×sqrt(365)), max drawdown, correlations
- Read-only hypothetical repricing: cash fixed, each asset shock overrides broad shock
- Methodology: "Historical portfolio-currency cost defines unrealized gain/loss. Asset-only HHI=sum of squared invested weights; effective positions=1/HHI. Sector classifications are unavailable."

## 13. Watchlist Package

### WatchlistController.java
- `GET /api/portfolios/{portfolioId}/watchlists` — list with symbols
- `POST` — create (name 1-80 chars, unique per portfolio)
- `PATCH /{id}` — rename; `DELETE /{id}` — delete
- `POST /{id}/items` — add symbol; `DELETE /{id}/items/{symbol}` — remove
- Duplicate guard via `DuplicateKeyException` → HTTP 409

## 14. History Package

### PortfolioHistoryController.java
- `GET /api/portfolios/{id}/history` — reads `portfolio_snapshots`, LIMIT 240, returns capturedAt, totalValue, cashBalance, holdingsValue, currency, valuationSource

### PortfolioHistoryRecorder.java
- `@Service`, `@Scheduled(fixedDelay=30000, initialDelay=5000)` — records snapshots for all portfolios
- `recordPortfolio(Portfolio, Map<String, MarketPrice> quotes)` — FOR SHARE lock on portfolio, validates quotes are recent (< 60s, future tolerance 10s, matching currency), computes holdingsValue, INSERT INTO portfolio_snapshots with `clock_timestamp()` and positions_verified=TRUE, INSERT INTO portfolio_snapshot_positions
- Skips snapshot if market unavailable or any quote invalid

## 15. Business Rules Package

### MarketRulesController.java
- `POST /api/business-rules/evaluate` → `MarketRulesService.Evaluation`

### MarketRulesRequest.java (record)
- Fields: market, side, quantity, price, availableCash, availableShares, estimatedCharges, lowerPriceLimit, upperPriceLimit, quantityIncrement

### MarketRulesService.java
- `evaluate(...)` — validates market (NSE/BSE/NYSE/NASDAQ), side (BUY/SELL), quantity/price positive
- Currency: INR for NSE/BSE, USD for NYSE/NASDAQ
- Checks: BUYING_POWER (cash >= price×qty + charges), SELL_AVAILABILITY (shares >= qty), PRICE_RESTRICTIONS (price within limits), QUANTITY_INCREMENT (qty % increment == 0)
- Overall status: FAIL / NEEDS_DATA / PASS

## 16. Bonus Package

### BonusController.java
- `POST /api/bonus/simulate` — calls `BonusSimulationService.simulate()`

### BonusSimulationService.java
- `simulate(BigInteger existingShares, BigInteger bonusShares, BigInteger requiredShares)` — all required; existing >= 0; bonus/required > 0; no fractional shares (remainder must be 0); additionalShares = (existing × bonus) / required; totalShares = existing + additional

### BonusSimulationRequest.java / BonusSimulationResponse.java (records)
- Request: existingShares, bonusShares, requiredShares (BigInteger)
- Response: existingShares, bonusShares, requiredShares, additionalShares, totalShares, calculation, disclaimer

## 11. Notification Package

### NotificationController.java
- `GET /api/portfolios/{portfolioId}/notifications?before=&limit=` — paginated notification list, limit max 100
- `GET /unread-count` — count of notifications where read_at IS NULL
- `PATCH /{notificationId}/read` and `PATCH /{notificationId}/unread` — toggle read state

### NotificationEventConsumer.java
- `@Component @KafkaListener(topics = "portfoliolab.notifications.v1")` — `@Transactional`
- Parses JSON payload; validates eventType against `NotificationPreferences.TYPES`
- Deduplication via `notification_receipts` table (ON CONFLICT DO NOTHING)
- Checks notification_preferences; disabled events don't create notices
- Suppresses TRADE_EXECUTED if an execution receipt already exists for the same transaction
- INSERT INTO notifications for ORDER_, AGENT_INSIGHT, DIVIDEND_CREDITED, PRICE_ALERT, TRADE_EXECUTED types
- Sanitizes targetUrl (must start with /, not //)

### NotificationKafkaConfig.java
- `@Configuration @EnableKafka`
- Producer: acks=all, enable.idempotence=true, max.block.ms=5000, request.timeout.ms=5000, delivery.timeout.ms=10000
- Consumer: enable.auto.commit=false, max.poll.records=25, DefaultErrorHandler with FixedBackOff(5000ms, Long.MAX_VALUE) — never discards during outage

### NotificationOutbox.java
- `@Component`; `recordTrade(portfolioId, transactionId, symbol, side, quantity)` — UUID eventId, INSERT INTO notification_outbox with TRADE_EXECUTED payload

### NotificationOutboxPublisher.java
- `@Component`, `@Scheduled(fixedDelay=2000)` — reads up to 25 pending outbox rows, sends to Kafka topic `portfoliolab.notifications.v1`, marks published_at after Kafka ack

### NotificationPreferences.java
- `@RestController @RequestMapping("/api/portfolios/{portfolioId}/notifications/preferences")`
- `TYPES = {ORDER_FILLED, ORDER_PARTIALLY_FILLED, ORDER_CANCELLED, ORDER_EXPIRED, PRICE_ALERT, TRADE_EXECUTED, DIVIDEND_CREDITED, AGENT_INSIGHT}`
- `GET` — returns all types defaulting to true, overridden by DB preferences
- `PUT` — upserts preferences; validates all keys are known types

### NotificationRetention.java
- `@Component`, `@Scheduled(fixedDelay=3600000, initialDelay=60000)` — prunes notifications and outbox older than 90 days (batch 1000)

### ActivityController.java
- `GET /api/portfolios/{portfolioId}/activity?type=&beforeTime=&beforeKey=&limit=` — UNION of order events, transactions, dividends, legacy orders; pagination by (occurred_at, key) cursor

### MarketIntelligenceOutboxPublisher.java
- `@Component`, `@Scheduled(fixedDelay=3000, initialDelay=15000)` — publishes market_intelligence_outbox to Kafka topic `portfoliolab.market-intelligence.v1`

### NotificationJacksonConfig.java
- `@Configuration` — `@Bean ObjectMapper notificationObjectMapper()`

### PortfolioEventOutbox.java
- `@Component`; `record(long portfolioId, String type, Map<String,Object> attributes)` — UUID eventId, INSERT INTO notification_outbox

### PreTradeRiskService.java / PreTradeRiskController.java
- Pre-trade risk evaluation (backed by `pre_trade_risk_policies` table: max_order_value default 50000, max_position_pct default 100)

## 10. Market Package

### MarketController.java
- `GET /api/market/prices` → `List<MarketPrice>`; handles `MarketServiceUnavailableException` → HTTP 503

### MarketService.java
- `getCurrentPrices()` — calls `http://127.0.0.1:8081/prices` via RestClient; throws `MarketServiceUnavailableException` on failure

### MarketPrice.java (record)
- Fields: symbol, price, currency, updatedAt

### MarketServiceUnavailableException.java
- Extends RuntimeException; wraps RestClient failures

### MarketIntelligenceController.java
- `GET /api/market/intelligence?portfolioId=&scope=&type=&limit=` → `List<IntelligenceEvent>`

### MarketIntelligenceService.java
- `feed(long portfolioId, String scope, String type, int limit)` — scope: all/watchlist; type: ALL/SURGE/DROP; reads market_intelligence_events
- `observe()` — `@Scheduled(fixedDelay=5000, initialDelay=12000)`; fetches prices from Go simulator; INSERT into market_price_samples; checks 1-min (3% threshold) and 5-min (6% threshold) moves; INSERT market_intelligence_events + outbox → Kafka
- `pruneSamples()` — `@Scheduled(fixedDelay=3600000)`; DELETE market_price_samples older than 24 hours

### PriceAlertController.java
- `GET /api/portfolios/{portfolioId}/price-alerts`, `POST` (create), `DELETE /{id}` (cancel)

### PriceAlertService.java
- `CreateAlert(symbol, direction, targetPrice)`; `Alert(id, portfolioId, symbol, currency, direction, targetPrice, lastPrice, status, createdAt, triggeredAt)`
- `create(long portfolioId, CreateAlert)` — validates symbol/direction/targetPrice; checks symbol in live simulator; checks target is on opposite side of current price; INSERT INTO market_price_alerts
- `poll()` — `@Scheduled(fixedDelay=5000, initialDelay=5000)`; fetches prices; for each ACTIVE alert, checks if price crossed target; marks TRIGGERED, records PortfolioEventOutbox PRICE_ALERT
- `evaluate(MarketPrice quote)` — checks crossing direction; UPDATE alert status and last_price

## 8. FX Package

### FxController.java
- `GET /api/fx/convert?from=USD&to=INR&amount=100` → `FxConversionResponse`

### FxConversionService.java
- `convert(String from, String to, BigDecimal amount)`
  - Normalizes to uppercase 3-letter currency codes; validates amount > 0, precision ≤ 19, scale ≤ 4
  - Identity: if from == to, rate = 1.0
  - Direct lookup via `FxRateRepository.findFirstByBaseCurrencyAndQuoteCurrencyOrderByCapturedAtDescIdDesc`
  - Reverse lookup: invert rate; Cross via INR: source→INR→target
  - Rate scale 12, amount scale 4, HALF_UP rounding

### FxRate.java (Entity)
- Table: `fx_rates`; fields: id, base_currency, quote_currency, rate (NUMERIC(19,8)), source, captured_at
- Seeded: USD→INR = 85.0, EUR→INR = 92.0 (source: SIMULATED)

### FxRateRepository.java
- `findFirstByBaseCurrencyAndQuoteCurrencyOrderByCapturedAtDescIdDesc(String, String)`

### FrankfurterRateService.java
- `getLatestRate(String from, String to)` and `getHistoricalRate(String from, String to, LocalDate date)`
- Calls `https://api.frankfurter.dev/v2/rate/{base}/{quote}` via RestClient

### FrankfurterRateController.java
- `GET /api/fx/reference?from=&to=&date=`

### FxAttributionService.java
- `calculate(quantity, purchasePrice, currentPrice, purchaseFxRate, currentFxRate)`
- originalValue = qty × purchasePrice × purchaseFxRate; currentValue = qty × currentPrice × currentFxRate
- assetImpact = qty × (currentPrice - purchasePrice) × purchaseFxRate
- fxImpact = qty × currentPrice × (currentFxRate - purchaseFxRate)
- netChange = currentValue - originalValue; returnPercent = netChange × 100 / originalValue
- Inputs validated: positive, precision ≤ 19, scale ≤ 8

### FxAttributionController.java
- `POST /api/fx/attribution` → `AttributionResult`

## 9. Dividend Package

### DividendController.java
- `POST /api/dividends/simulate` — validates currency (INR/USD/EUR), calls `DividendSimulationService.calculateGrossDividend`

### DividendSimulationService.java
- `calculateGrossDividend(BigDecimal eligibleShares, BigDecimal dividendPerShare)` — eligibleShares must be whole number; result = shares × perShare, scale 2 HALF_UP

### DividendSimulationRequest.java / DividendSimulationResponse.java (records)
- Request: eligibleShares, dividendPerShare, currency
- Response: eligibleShares, dividendPerShare, grossDividend, currency, calculation, disclaimer

### DividendCreditController.java
- `POST /api/portfolios/{portfolioId}/dividends/credit` → `DividendCreditService.credit()`

### DividendCreditService.java
- `@Transactional` — validates request, referenceKey pattern `[A-Za-z0-9._:-]{1,120}`, dividendPerShare scale ≤ 4 precision ≤ 19
- Locks portfolio; checks currency matches portfolio currency; checks referenceKey not already used (idempotency)
- Computes eligible whole shares; amount = eligible × perShare, scale 4 HALF_UP
- INSERT INTO simulated_dividend_payments; updates portfolio cash_balance; records PortfolioEventOutbox DIVIDEND_CREDITED

### ScheduledDividendService.java
- `create(Long assetId, String referenceKey, BigDecimal dividendPerShare, String currency, Instant recordCutoff, Instant paymentAt)` — paymentAt must be after recordCutoff; INSERT INTO simulated_dividend_schedules
- `dueScheduleIds()` — SELECT WHERE payment_at <= NOW()
- `candidatePortfolioIds(long scheduleId)` — portfolios with BUY/SELL transactions for the asset by record cutoff
- `creditIfEligible(long scheduleId, long portfolioId)` — checks currency match, not already credited, computes eligible shares from net BUY-SELL by cutoff, INSERT INTO simulated_scheduled_dividend_payments, updates cash, records outbox

### ScheduledDividendScheduler.java
- `@Component`, `@Scheduled(fixedDelay=10000, initialDelay=10000)` — processes due schedules

### ScheduledDividendController.java
- `POST /api/dividends/schedules` and `GET /api/dividends/schedules`

### DividendSchedulingConfig.java
- `@Configuration @EnableScheduling` (enables scheduled dividend processing)

## 7. OMS Package (Order Management System)

### SimulatedOrderService.java
- `submit(long portfolioId, OrderRequest request)` — `@Transactional`
  - Validates: non-null request, assetId, type, quantity; side BUY/SELL; quantity positive whole number, precision ≤ 13 digits
  - Locks portfolio (`reservations.lock(portfolioId)`); validates portfolio and asset exist
  - orderType defaults to MARKET, timeInForce defaults to GTC; `OrderConditions.validate(kind, limitPrice, tif)`
  - `expires = OrderConditions.expiration(tif, now)` — DAY ends at next midnight Asia/Kolkata; GTC = null
  - INSERT INTO simulated_orders, RETURNING id; `reservations.reserve(id, portfolioId, request)`
  - Returns `get(portfolioId, id)`
- `get(long portfolioId, long orderId)` — SELECT by id and portfolioId, 404 if not found
- `list(long portfolioId)` — SELECT ORDER BY id DESC LIMIT 100
- `cancel(long portfolioId, long orderId)` — `@Transactional`, lock FOR UPDATE; only SUBMITTED/ACCEPTED/PARTIALLY_FILLED can be cancelled; sets status='CANCELLED', releases reservations

### OrderView.java (record inside SimulatedOrderService)
- Fields: id, portfolioId, assetId, side, requestedQuantity, filledQuantity, status, failureReason, orderType, limitPrice, timeInForce, expiresAt

### OrderReservations.java
- `lock(long portfolioId)` — `SELECT id FROM portfolios WHERE id=? FOR UPDATE`, 404 if empty
- `cash(long portfolioId, long except)` — SUM of reserved_cash except given id
- `shares(long portfolioId, long assetId, long except)` — SUM of reserved_shares
- `enforce(Portfolio, Asset, side, qty, amount, except)` — BUY: cash - reserved >= amount; SELL: held - reserved >= qty
- `reservationUnit(OrderRequest, Pricing quote)` — `(limitPrice or quote.price) × fxRate × 1.05`, ceil to 4 decimals
- `reserve(long id, long portfolioId, OrderRequest request)` — computes quote, unit, amount, validates precision ≤ 19, risk.enforce, enforce, UPDATE order with reservation_managed, reserved_cash/shares, cash_per_share
- `remaining(long id, BigDecimal qty)` — updates reserved_cash = cash_per_share × qty; reserved_shares = qty for SELL
- `release(long id)` — remaining(id, ZERO)
- `availability(long portfolioId)` — `@Transactional(readOnly, REPEATABLE_READ)`; returns availableBuyingPower, reservedCash, positions with available_quantity

### OrderConditions.java
- `validate(String kind, BigDecimal limit, String tif)` — validates MARKET/LIMIT, DAY/GTC; MARKET disallows limit; LIMIT requires positive price ≤ 4 decimals, precision ≤ 19
- `expiration(String tif, Instant now)` — DAY → next midnight Asia/Kolkata; GTC → null
- `eligible(String side, BigDecimal limit, BigDecimal price)` — BUY: price <= limit; SELL: price >= limit
- `PriceNotEligible extends ResponseStatusException` — HTTP 409 "Limit price is not currently executable"

### OrderEventStream.java
- `@Service` + `@RestController` — SSE endpoint at `/api/portfolios/{portfolioId}/simulated-orders/events`
- `connect(long portfolioId, String lastId)` — only portfolio 1, max 100 clients, cursor from MAX(id), sends "reset" on connect
- `dispatch()` — `@Scheduled(fixedDelay=1000, scheduler="orderStreamScheduler")`; reads events after cursor, sends "order" events, sends "notification" invalidation, sends heartbeat comments
- `OrderEventController` inner class — `@GetMapping(produces="text/event-stream")`
- `OrderStreamScheduling` inner config — two `ThreadPoolTaskScheduler` beans (poolSize=1 each)

### SimulatedExchangeWorker.java
- `@Component`, scheduled `fixedDelayString="${oms.worker.delay:2500}"`, `initialDelayString="${oms.worker.initial-delay:5000}"`
- `executeNext()` → `executePortfolio(null)` — processes one order per cycle
- Locks portfolio, SELECT pending order FOR UPDATE SKIP LOCKED
- Gets quote from market service, checks LIMIT eligibility via `OrderConditions.eligible`
- Checks DAY expiration before fill; `ExpiredDuringFill` → marks EXPIRED, releases reservations
- Calls `settlement.settle(...)` → creates Transaction
- INSERT simulated_exchange_executions, INSERT simulated_order_fills
- UPDATE order filled_quantity, status (FILLED or PARTIALLY_FILLED)
- `reservations.remaining(order.id(), remainingQty)`
- `PriceNotEligible` → `defer(orderId)` (retries later)
- `ResponseStatusException` 5xx → defer; 4xx → REJECTED or CANCELLED with failure_reason
- Other exceptions → defer (transient, will retry)

### ReconciliationService.java
- `@Service` + `@RestController` at `/api/portfolios/{portfolioId}/reconciliation`
- `reconcile(long portfolioId)` — complex SQL CTE checking: MISSING_SETTLEMENT_LINK, EXECUTION_TRANSACTION_MISMATCH, RECEIPT_FILL_COUNT_MISMATCH, RECEIPT_FILL_QUANTITY_MISMATCH, ORDER_FILLED_QUANTITY_MISMATCH, INVALID_FILLED_STATUS, INVALID_PARTIAL_STATUS, INVALID_UNFILLED_STATUS, INVALID_CANCELLED_STATUS, TERMINAL_RESERVATION, LEGACY_UNRESERVED_ORDER, RESERVATION_QUANTITY_MISMATCH, OVER_RESERVED_CASH, OVER_RESERVED_SHARES
- Returns `Report(portfolioId, checkedOrders, exceptionCount, exceptions, scope)`

## 6. Portfolio Package

### Portfolio.java (Entity)
- Table: `portfolios`; fields: id (BIGSERIAL PK), name (VARCHAR(100)), cash_balance (NUMERIC(19,4), non-null, >=0), currency (VARCHAR(3))
- `setCashBalance` validates non-negative

### PortfolioRepository.java
- Extends `JpaRepository<Portfolio, Long>`
- `findByIdForUpdate(Long id)` — `@Lock(PESSIMISTIC_WRITE)`, `@Query("SELECT p FROM Portfolio p WHERE p.id = :id")`

### PortfolioService.java
- `getPortfolio(Long id)` — `@Transactional(readOnly=true)`, returns `PortfolioResponse` or 404

### PortfolioController.java
- `GET /api/portfolios/{id}` → `PortfolioResponse`

### HoldingResponse.java (record)
- Fields: assetId, symbol, name, quantity, averageBuyPrice, currentPrice, marketValue, unrealizedProfitLoss, currency, currentFxRate, marketValueInPortfolioCurrency, portfolioCurrency, historicalCostInPortfolioCurrency, unrealizedProfitLossInPortfolioCurrency

### OrderRequest.java (record)
- Fields: assetId, type, quantity, orderType (default "MARKET"), limitPrice (default null), timeInForce (default "GTC")
- Convenience constructor: `OrderRequest(Long assetId, String type, BigDecimal quantity)` → MARKET, GTC

### OrderResponse.java (record)
- Fields: transactionId, portfolioId, assetSymbol, type, quantity, pricePerUnit, totalAmount, currency, executionFxRate, portfolioAmount, portfolioCurrency, remainingCashBalance

### Transaction.java (Entity)
- Table: `transactions`; fields: id, portfolio_id, asset_id, transaction_type (BUY/SELL), quantity (NUMERIC(19,6)), price_per_unit (NUMERIC(19,4)), total_amount (NUMERIC(19,4)), currency, execution_fx_rate (NUMERIC(19,8)), portfolio_amount (NUMERIC(19,4)), created_at
- ManyToOne to Portfolio and Asset

### TransactionRepository.java
- `findByPortfolioIdOrderByCreatedAtDesc(Long portfolioId)`

### TransactionResponse.java (record)
- Fields: id, assetSymbol, type, quantity, pricePerUnit, totalAmount, currency, createdAt

### PerformanceAccounting.java (utility)
- `money(BigDecimal)` — round to 4 decimals HALF_UP
- `pct(BigDecimal, BigDecimal)` — percentage, null if total <= 0
- `replay(List<Fill>)` — weighted-average cost basis replay of BUY/SELL fills
- `contribution(opening, closing, buys, sells, dividends)` — period contribution formula

### PortfolioIntelligenceService.java
- `performance(long id, String period)` → `Performance` record with series, return %, attribution, totals, warnings
- `plan(long id, Targets targets)` → `Plan` record with adjustments, feasibility, warnings
- Read-only rebalancing planner: whole shares, 5% cash reserve buffer matching OMS, risk policy check per ticket

### PortfolioIntelligenceController.java
- `GET /api/portfolios/{id}/performance?period=1M`
- `POST /api/portfolios/{id}/rebalance/preview`