# DOCUMENTATION 06 — AI Service Deep Dive (portfoliolab-ai, Sibling Repo)

## 1. Overview

- **Location:** `c:\Users\hanee\projects2026\portfoliolab-ai\` (sibling repository)
- **Language:** Node.js/TypeScript, tsx runner
- **MCP SDK:** `@modelcontextprotocol/client` + `/server` v2.3.1 range
- **Validation:** Zod v4
- **LLM:** Ollama `qwen2.5:0.5b` on port 11434
- **Port:** `3101` (loopback only)
- **Purpose:** Ask AI — educational explanations, holdings analysis, read-only order/reconciliation evidence via MCP
- **Read-only:** All AI tools expose read-only evidence/calculations, not trading authority

## 2. Source Files

| File | Purpose |
|------|---------|
| `src/server.ts` | HTTP server, API routes, Ollama chat integration |
| `src/mcp-client.ts` | MCP stdio client for order/dividend/bonus/rules tools |
| `src/mcp-server.ts` | MCP stdio server exposing read-only tools |
| `src/order-intelligence.ts` | Zod schemas, order parsing, intent router, evidence formatting |
| `src/portfolio.ts` | Holdings fetch from Spring Boot backend |

## 3. server.ts — HTTP Server

**Port:** 3101 | **Model:** qwen2.5:0.5b

**System prompt:** "You are PortfolioLab AI, an educational assistant for a simulated investment portfolio. Explain concepts clearly. Never invent portfolio balances, holdings, or prices. Do not claim to have accessed portfolio data."

### Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `POST /api/portfolio/chat` | POST | Ask AI chat → Ollama |
| `POST /api/agents/business-rules/evaluate` | POST | Market rules via MCP |
| `POST /api/agents/bonus/simulate` | POST | Bonus simulation via MCP |
| `POST /api/agents/dividend/simulate` | POST | Dividend simulation via MCP |
| `GET /api/portfolio/:id/holdings` | GET | Holdings via MCP |

### /api/portfolio/chat
- Validates: message (1-2000 chars), portfolioId (safe int > 0), researchContext (optional, portfolioId=1, max 4096 chars)
- Calls Ollama `http://127.0.0.1:11434/api/chat` (120s timeout)
- Returns: `{ reply, model, holdingsCount }`
- Order/reconciliation questions use deterministic MCP path (not Ollama)

## 6. order-intelligence.ts — Schemas & Intent Router

### Zod Schemas
- `idSchema` — positive safe integer
- `quantitySchema` — non-negative safe integer or string like "10.0"
- `orderSchema` — full simulated order with side, quantities, status, sanitized failureReason
- `reportSchema` — reconciliation report (portfolioId, checkedOrders, exceptionCount, exceptions)

### Evidence Sanitization
`publicReason(reason)` withholds detailed failure reasons. Only allows: "Insufficient virtual cash", "Insufficient holdings", "Order rejected by settlement", or pre-trade risk codes (MAX_ORDER_VALUE, MAX_POSITION_COST_CONCENTRATION). All others → "A failure reason was recorded, but its details are deliberately withheld in Ask AI."

### Deterministic Intent Router
Routes user messages to:
1. **Reconciliation** — message contains "reconciliation"/"reconcile"/"consistency"
2. **Order ID** — message contains a number matching order ID pattern
3. **Recent orders** — message contains "recent orders"/"latest order"/"last order"
4. **Scope** — otherwise returns scope explanation

For reconciliation: calls `get_reconciliation_report`, optionally filters by order ID, verifies order exists via `get_simulated_order`.
For order details: calls `get_simulated_order`, optionally fetches reconciliation report for consistency.
For recent list: calls `list_simulated_orders`, sorts by ID desc, optionally limits to latest 1.

### readOrderEvidence
Fixed routes and GET only; no caller-provided URLs/methods/mutation endpoints. Calls `http://127.0.0.1:8080/api/portfolios/{portfolioId}/simulated-orders` or `/reconciliation`. Validates response schema; returns sanitized evidence.

## 7. portfolio.ts — Holdings Fetch
```typescript
const BACKEND_URL = "http://127.0.0.1:8080";
export type Holding = { symbol, name, quantity, currency, marketValueInPortfolioCurrency, unrealizedProfitLossInPortfolioCurrency, portfolioCurrency };
export async function getPortfolioHoldings(portfolioId: number): Promise<Holding[]>
```

## 8. Security & Limitations

- Read-only only: no trade placement, no portfolio modification
- No authentication: portfolio ID 1 is demo scope
- Ollama model can invent incorrect explanations; compare answers with API evidence
- No paid API or API key needed
- AI health check does not verify model availability
- MCP stdio child processes via npx.cmd; requires npx.cmd on PATH

## 4. mcp-client.ts — MCP stdio Client

Connects via `npx.cmd --no-install tsx src/mcp-server.ts` (stdio transport). New connection per call.

### Functions
- `callOrderToolThroughMcp(name, input)` — order evidence: `list_simulated_orders`, `get_simulated_order`, `get_reconciliation_report`; validates IDs via Zod
- `getHoldingsThroughMcp(portfolioId)` — holdings via `list_portfolio_holdings`
- `simulateDividendThroughMcp(eligibleShares, dividendPerShare, currency)` — dividend simulation
- `simulateBonusThroughMcp(existingShares, bonusShares, requiredShares)` — bonus simulation
- `evaluateMarketRulesThroughMcp(input)` — market rules evaluation

Each: creates client → connects → calls tool → parses text response as JSON → closes connection.

## 5. mcp-server.ts — MCP stdio Server

Uses `serveStdio` for stdio communication. 7 read-only tools:

| Tool | Input Schema |
|------|--------------|
| `list_portfolio_holdings` | `{ portfolioId: number (positive int) }` |
| `simulate_dividend` | `{ eligibleShares, dividendPerShare, currency: INR\|USD\|EUR }` |
| `simulate_bonus` | `{ existingShares, bonusShares, requiredShares }` |
| `evaluate_market_rules` | Full MarketRulesInput schema |
| `list_simulated_orders` | `{ portfolioId }` |
| `get_simulated_order` | `{ portfolioId, orderId }` |
| `get_reconciliation_report` | `{ portfolioId }` |

All tools: `readOnlyHint: true`, `destructiveHint: false`. Errors return `isError: true` with sanitized messages (no stack traces).