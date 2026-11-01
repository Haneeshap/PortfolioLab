# DOCUMENTATION 05 — Market Simulator Deep Dive (Go)

## 1. Overview

- **Location:** `services/market-simulator/`
- **Language:** Go 1.27.0
- **WebSocket library:** `github.com/coder/websocket v1.8.15`
- **Port:** `127.0.0.1:8081` (loopback only)
- **Module:** `github.com/portfoliolab/market-simulator`
- **Purpose:** Generates live simulated prices for 25 fictional INR assets; provides historical fictional OHLCV fixtures; WebSocket pushes prices every 5 seconds

## 2. Source Files

| File | Purpose |
|------|---------|
| `main.go` | HTTP server, route registration, WebSocket handler, startup |
| `simulator.go` | MarketSimulator struct, price generation, initial prices/volatility |
| `history.go` | Fictional history fixture generation, `/history` HTTP handler |
| `go.mod` / `go.sum` | Go module definition and dependencies |

## 3. main.go

Creates `NewMarketSimulator()`, registers routes on `http.NewServeMux()`:
- `GET /health` → `{"status":"UP","service":"market-simulator"}`
- `GET /prices` → JSON array of AssetPrice
- `GET /ws/prices` → WebSocket (OriginPatterns: localhost:*, 127.0.0.1:*); sends prices immediately, then every 5s
- `GET /history` → delegated to history.go

Starts background goroutine: `time.NewTicker(5s)` → `simulator.UpdatePrices()` every 5 seconds.
Listens on `http.ListenAndServe("127.0.0.1:8081", mux)`.

Single shared simulator instance for all connected clients.

## 5. history.go — Fictional History Fixtures

### Candle struct
```go
type Candle struct {
    Time   string  `json:"time"`
    Open   float64 `json:"open"`
    High   float64 `json:"high"`
    Low    float64 `json:"low"`
    Close  float64 `json:"close"`
    Volume int64   `json:"volume"`
}
```

### GenerateHistory(symbol, from, to)
- **Anchor:** 2025-01-01 UTC
- **Seed:** Last price from `NewMarketSimulator().prices[symbol]`
- **Validation:** from >= 2025-01-01, to > from, to-from <= 366 days, to <= today UTC
- **RNG:** FNV-1a 64-bit hash of symbol → deterministic seed per symbol
- **Generation:** Iterates daily from anchor to `to`:
  - `open = roundPrice(close)` (previous close; roundPrice rounds to 4 decimals)
  - `change := 0.0003 + 0.008*sin(i*0.7) + (rng.Float64()-0.5)*0.025`
  - `close = roundPrice(max(0.01, open*(1+change)))`
  - `high = roundPrice(max(open, close) * (1 + rng.Float64()*0.008))`
  - `low = roundPrice(max(0.0001, min(open, close)*(1-rng.Float64()*0.008)))`
  - `volume = 10000 + rng.Intn(90000)` (10K–100K fictional units)
  - Includes only days in [from, to) range
- **Deterministic:** Same symbol + date range always produces identical candles
- **Independent:** Never reads or modifies the mutable live-price map

### historyHandler
- Query params: `from` (YYYY-MM-DD), `to` (YYYY-MM-DD, exclusive), `symbol`
- Response: `{"symbol": ..., "source": "fictional-history-v1", "interval": "1d", "candles": [...]}`
- Errors: 400 for invalid dates, unknown symbol, or range violations

## 6. Integration Points

- **Spring Boot MarketService:** Calls `http://127.0.0.1:8081/prices` via RestClient; wraps failures in `MarketServiceUnavailableException` → HTTP 503
- **Spring Boot ResearchHistoryStore:** Calls `http://127.0.0.1:8081/history` (3s connect / 5s read timeout); validates source="fictional-history-v1", interval="1d", candle count, OHLC invariants; inserts into `fictional_market_candles` (ON CONFLICT DO NOTHING)
- **Frontend:** `GET /api/market/prices` → Spring Boot → Go; `GET /api/research/assets/[assetId]/history` → Spring Boot → Go; WebSocket `ws://localhost:8081/ws/prices` → MarketPriceProvider

## 7. Limitations

- No OHLCV endpoint in original design; added in M38 via Go `/history`
- No durable daily history in Go; regenerated deterministically each time
- No administrative price override endpoint
- No persistence of live price history (PostgreSQL samples pruned after 24h)
- Prices reset on simulator restart
- 25 fixed fictional assets only; no dynamic asset creation

## 4. simulator.go — Price Generation

### Types
```go  
type AssetPrice struct {
    Symbol    string    `json:"symbol"`
    Price     float64   `json:"price"`
    Currency  string    `json:"currency"`
    UpdatedAt  time.Time `json:"updatedAt"`
}

type MarketSimulator struct {
    mu         sync.RWMutex
    prices     map[string]AssetPrice
    volatility map[string]float64
}
```

### Methods
- `GetPrices()` — RLock, returns copy of all prices as `[]AssetPrice`
- `UpdatePrices()` — Lock, applies random walk:
  ```
  change := (rand.Float64() - 0.5) * 2 * volatility[symbol]
  asset.Price = asset.Price * (1 + change) 
  ```
  Max single-step change: ±volatility (e.g., ±2% for BIOVA at 0.020). Runs every 5s in background goroutine.   

### Initial Prices (25 assets, all INR)   

| Symbol | Price | Volatility |
|--------|-------|------------|
| ALPHA | 98.40 | 0.010 |
| DEMO | 125.50 | 0.010 |
| GREEN | 315.25 | 0.010 |
| NOVA | 842.75 | 0.010 |
| ORBIT | 1560.00 | 0.010 |
| NEXUS | 1245.00 | 0.013 |
| QUANT | 2180.00 | 0.018 |
| CYBER | 875.00 | 0.016 |
| CLOUD | 1560.00 | 0.014 |
| FINIX | 640.00 | 0.009 |
| VAULT | 1120.00 | 0.008 |
| CREDO | 425.00 | 0.013 |
| PAYGO | 310.00 | 0.017 |
| TRUST | 1780.00 | 0.008 |
| SOLAR | 485.00 | 0.017 |
| VOLT | 725.00 | 0.015 |
| HYDRO | 365.00 | 0.010 |
| STEEL | 920.00 | 0.011 |
| METRO | 580.00 | 0.009 |
| MEDIX | 1340.00 | 0.010 |
| BIOVA | 765.00 | 0.020 |
| CAREX | 545.00 | 0.012 |
| FRESH | 295.00 | 0.008 |
| URBAN | 690.00 | 0.011 |
| AURORA | 1095.00 | 0.009 |

Prices are purely fictional; no relation to real markets. Reset on simulator restart (no persistence).