# M34: Trading UI and asynchronous OMS

The existing TradeForm submits M31 orders. Submission success displays the order ID
and returned initial status, never a claim that the trade executed. Asset selection,
whole-share validation, live-quote checks, M30 preview, and business-rules review
remain in the same form. Preview is advisory; it does not reserve cash, shares, or
a price. The existing Spring worker remains responsible for all execution,
per-fill risk enforcement, pricing, settlement, receipts, and failure transitions.

## Contracts

All new Next.js routes use demo portfolio 1 and `Cache-Control: no-store`:

| Next.js route | Existing Spring Boot route |
| --- | --- |
| `GET /api/portfolio/simulated-orders` | `GET /api/portfolios/1/simulated-orders` |
| `POST /api/portfolio/simulated-orders` | `POST /api/portfolios/1/simulated-orders` |
| `GET /api/portfolio/simulated-orders/{orderId}` | `GET /api/portfolios/1/simulated-orders/{orderId}` |
| `POST /api/portfolio/simulated-orders/{orderId}/cancel` | `POST /api/portfolios/1/simulated-orders/{orderId}/cancel` |

Submission sends `{assetId, type: "BUY" | "SELL", quantity}`. Quantity must be a
positive whole number with at most 13 digits. No client portfolio override is forwarded.
Successful responses use the existing OrderView: `id`, `portfolioId`, `assetId`,
`side`, `requestedQuantity`, `filledQuantity`, `status`, `failureReason`.
Responses are validated and business failure reasons sanitized. Order IDs must be
positive safe integers. Existing backend APIs, DTOs, schema, worker, and settlement
algorithms are unchanged. The legacy `/api/portfolio/orders` proxy remains for
compatibility but is no longer used by TradeForm. Preview still uses
`POST /api/portfolio/orders/preview`.

## Monitor behavior

Recent Orders is a scrollable section under the existing ticket. It shows persisted
status and requested/filled/unfilled quantities; inconsistent state is flagged for
Ask AI investigation. Details always fetch the exact portfolio-scoped order GET.

Updates use a serial loop with a 3-second gap while active orders exist, at most
100 rounds per session and at most 3 consecutive read failures. Reads time out;
unmounting or restarting cancels in-flight status requests and clears the timer.
Refresh orders restarts polling. A newly submitted order also restarts monitoring.
Known active orders outside the latest-100 response continue to be read individually.
Unknown older orders outside that response cannot be discovered without pagination.

Status or filled-quantity changes invoke the existing portfolio refresh callback,
which fetches holdings, cash, and transactions together through `/api/portfolio`.
First-observed fills also trigger refresh. Failed portfolio refreshes are reported
and retried within the polling budget, including after orders become terminal.

Cancel is enabled only for SUBMITTED, ACCEPTED, and PARTIALLY_FILLED, and always
requires explicit browser confirmation. The message warns that existing fills
remain settled and more fills may occur before cancellation. The server row lock
arbitrates cancellation/fill races; HTTP 409 causes a status refresh, not a retry.
Cancellation cannot reverse a fill. No mutation is automatically retried.

## Verification

With existing dependencies installed (Node 24 for the native test loader):

```powershell
cd C:\Users\hello\Projects\PortfolioLab\frontend
npm run test:m34
.\node_modules\.bin\tsc.cmd --noEmit --incremental false
```

Existing mocked backend tests, without starting Spring or modifying the database:

```powershell
cd C:\Users\hello\Projects\PortfolioLab\backend
.\mvnw.cmd -o '-Dtest=OrderPreviewServiceTest,OrderPricingServiceTest,OrderServiceTest,OrderServicePartialSaleTest,ReconciliationServiceTests' test
```

Existing Ask AI regressions:

```powershell
cd C:\Users\hello\Projects\portfoliolab-ai
npm test
```

The M34 suite tests route contracts, input/response validation, submission success
and failure, uncertain outcomes, rendered order states, cancellation eligibility
and confirmation, terminal races, exact detail retrieval, polling bounds/cleanup,
and portfolio refresh after fills. It uses mock HTTP responses and React server
rendering; it does not place live test trades or exercise a browser end to end.

## Launch and manual check

Use the existing PostgreSQL, Kafka, Go market simulator, and Spring Boot setup.
In separate terminals:

```powershell
cd C:\Users\hello\Projects\PortfolioLab
docker compose up -d
cd backend
.\mvnw.cmd spring-boot:run
```

```powershell
cd C:\Users\hello\Projects\PortfolioLab\services\market-simulator
go run .
```

```powershell
cd C:\Users\hello\Projects\PortfolioLab\frontend
npm run dev
```

For Ask AI, also run `npm start` from `C:\Users\hello\Projects\portfoliolab-ai`;
keep the existing Ollama service running for educational/holdings replies.

Open `http://localhost:3000/portfolio`, open the trade ticket, validate the order,
then submit a deliberately chosen simulated quantity. Expect an ID and initial
status. Watch persisted transitions and holdings updates; open details and ask
Ask AI about that same order ID. To check cancellation, choose an eligible order,
review the confirmation, and verify the returned terminal state. Small orders may
finish before cancellation is attempted. Each fill appears as a settled transaction
in Activity; cancelled partial orders retain their earlier transactions.

## Limitations

- Demo portfolio 1 only. Portfolio scoping exists; authentication and ownership
  enforcement do not. This milestone adds no ownership claims.
- M31 has no idempotency key. Timeout/5xx/malformed submission replies have uncertain
  outcomes. Inspect Recent Orders before explicitly submitting again.
- Polling ends when no active orders remain, on its budget, or when the page unmounts.
  Refresh to discover orders submitted elsewhere. Closing the ticket disclosure
  keeps the component mounted, so its bounded monitor can continue.
- Order and portfolio GETs are separate reads, not one atomic snapshot. Details
  expose cumulative fills; the existing OrderView has no individual receipt data.
- Legacy synchronous trades remain transaction history outside M31 order tracking.
  M32/M33 retain their existing internal-consistency scope.
