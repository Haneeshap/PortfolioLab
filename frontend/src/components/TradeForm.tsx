"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useMarketPrices } from "./MarketPriceProvider";
import type { Portfolio, Holding } from "./usePortfolioData";
import { assessOrder, parseRuleResult } from "./orderAssessment";
import RecentOrders from "./RecentOrders";
import { DEMO_PORTFOLIO_ID, submitSimulatedOrder, type SimulatedOrder } from "@/lib/simulated-orders";
type Asset = {
  id: number;
  symbol: string;
  name: string;
  price: number;
  currency: string;
};

type TradeFormProps = {
  assets: Asset[];
  portfolio: Portfolio;
  holdings: Holding[];
  onTradeCompleted: () => Promise<void>;
  holdingTradeRequest?: { assetId: number; sequence: number } | null;
};

type Market = "NSE" | "BSE" | "NYSE" | "NASDAQ";
type ValidationStatus = "PASS" | "FAIL" | "NEEDS_DATA";

type RuleCheck = {
  code: string;
  status: ValidationStatus;
  explanation: string;
};

type ValidationResult = {
  market: Market;
  currency: string;
  side: "BUY" | "SELL";
  overallStatus: ValidationStatus;
  checks: RuleCheck[];
  disclaimer: string;
};
type OrderPreview = {
  assetSymbol: string;
  side: "BUY" | "SELL";
  quantity: number;
  estimatedPrice: number;
  assetCurrency: string;
  estimatedAssetTotal: number;
  fxRate: number;
  estimatedPortfolioTotal: number;
  portfolioCurrency: string;
  availableCash: number;
  estimatedCharges: number;
  sufficientCash: boolean | null;
  disclaimer: string;
};

export default function TradeForm({
  assets,
  portfolio,
  holdings,
  onTradeCompleted,
  holdingTradeRequest,
}: TradeFormProps) {
  const { prices, status } = useMarketPrices();

  const searchParams = useSearchParams();
  const requestedAssetId = searchParams.get("assetId");

  const initialAssetId =
    requestedAssetId &&
    assets.some((asset) => String(asset.id) === requestedAssetId)
      ? requestedAssetId
      : String(assets[0]?.id ?? "");

  const [assetId, setAssetId] = useState(initialAssetId);

  // Prop-driven selections update before rendering children; ordinary quote refreshes
  // must not reset an asset the user selected manually.
  const requestedSelection = requestedAssetId && assets.some(asset => String(asset.id) === requestedAssetId) ? requestedAssetId : null;
  const holdingSelection = holdingTradeRequest && assets.some(asset => asset.id === holdingTradeRequest.assetId) ? holdingTradeRequest : null;
  const [previousSelection, setPreviousSelection] = useState({ requested: requestedSelection, holding: holdingSelection });
  if (previousSelection.requested !== requestedSelection || previousSelection.holding?.sequence !== holdingSelection?.sequence || previousSelection.holding?.assetId !== holdingSelection?.assetId) {
    setPreviousSelection({ requested: requestedSelection, holding: holdingSelection });
    if (holdingSelection && (previousSelection.holding?.sequence !== holdingSelection.sequence || previousSelection.holding?.assetId !== holdingSelection.assetId)) setAssetId(String(holdingSelection.assetId));
    else if (requestedSelection) setAssetId(requestedSelection);
  }

  const [type, setType] = useState<"BUY" | "SELL">("BUY");
  const [orderType, setOrderType] = useState<"MARKET" | "LIMIT">("MARKET");
  const [limitPrice, setLimitPrice] = useState("");
  const [timeInForce, setTimeInForce] = useState<"DAY" | "GTC">("DAY");
  const [quantity, setQuantity] = useState("1");
  const [submitting, setSubmitting] = useState(false);
  const submissionInFlight = useRef(false);
  const [submittedOrder, setSubmittedOrder] = useState<SimulatedOrder | null>(null);
  const [availability, setAvailability] = useState<{availableBuyingPower:number;reservedCash:number;positions:{asset_id:number;reserved_quantity:number;available_quantity:number}[]} | null>(null);
  useEffect(() => {
    const controller=new AbortController();
    void fetch("/api/portfolio/simulated-orders/availability",{signal:controller.signal,cache:"no-store"})
      .then(async response => {if(!response.ok) throw Error();return response.json();})
      .then(value => {if(!controller.signal.aborted) setAvailability(value);}).catch(() => {if(!controller.signal.aborted) setAvailability(null);});
    return () => controller.abort();
  },[portfolio,submittedOrder]);
  const buyingPower=availability===null?null:Number(availability.availableBuyingPower);
  const [market, setMarket] = useState<Market>("NSE");
  const [pendingValidationKey, setPendingValidationKey] = useState<string | null>(null);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [orderPreview, setOrderPreview] = useState<OrderPreview | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const selectedAsset = assets.find(
    (asset) => asset.id === Number(assetId)
  );

  const parsedQuantity = Number(quantity);
  const validQuantity =
    quantity.trim() !== "" &&
    Number.isSafeInteger(parsedQuantity) &&
    parsedQuantity > 0 &&
    parsedQuantity.toString().length <= 13;

  const liveQuote = prices.find(
    (quote) => quote.symbol === selectedAsset?.symbol
  );

  const quoteTime = liveQuote
    ? Date.parse(liveQuote.updatedAt)
    : NaN;

  const quoteIsValid =
    status === "connected" &&
    !!selectedAsset &&
    !!liveQuote &&
    Number.isFinite(liveQuote.price) &&
    liveQuote.price > 0 &&
    liveQuote.currency === selectedAsset.currency &&
    Number.isFinite(quoteTime) &&
    quoteTime >= now - 60000 &&
    quoteTime <= now + 10000;

  const estimatedTotal =
    quoteIsValid && liveQuote && validQuantity
      ? liveQuote.price * parsedQuantity
      : null;

  const formatMoney = (amount: number, currency: string) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
    }).format(amount);

  const marketOptions: Market[] =
    selectedAsset?.currency === "INR"
      ? ["NSE", "BSE"]
      : selectedAsset?.currency === "USD"
        ? ["NYSE", "NASDAQ"]
        : [];

  const selectedMarket: Market =
    marketOptions.includes(market) ? market : marketOptions[0] ?? "NSE";

  const matchingHolding = holdings.find(
    (holding) => holding.assetId === selectedAsset?.id
  );

  const reservedPosition=availability?.positions.find(p => Number(p.asset_id)===selectedAsset?.id);
  const availableShares = reservedPosition ? Number(reservedPosition.available_quantity) : matchingHolding?.quantity ?? 0;

  const validationKey = JSON.stringify({
    orderType, limitPrice, timeInForce,
    portfolioId: portfolio.id,
    assetId: selectedAsset?.id,
    type,
    quantity,
    market: selectedMarket,
    price: quoteIsValid ? liveQuote?.price : null,
    quoteUpdatedAt: liveQuote?.updatedAt ?? null,
    quoteCurrency: liveQuote?.currency ?? null,
    marketConnectionStatus: status,
    quoteIsValid,

    portfolioCash: portfolio.cashBalance, buyingPower,
    portfolioCurrency: portfolio.currency,
    availableShares,
  });

  const [previousValidationKey, setPreviousValidationKey] = useState(validationKey);
  if (previousValidationKey !== validationKey) {
    setPreviousValidationKey(validationKey);
    setPendingValidationKey(null);
  }
  const validating = pendingValidationKey === validationKey;
  const [validatedKey, setValidatedKey] = useState<string | null>(null);

  const latestValidationKey = useRef(validationKey);
  const validationAbortController = useRef<AbortController | null>(null);

  useLayoutEffect(() => {
  latestValidationKey.current = validationKey;

  validationAbortController.current?.abort();
  validationAbortController.current = null;
  return () => { validationAbortController.current?.abort(); validationAbortController.current = null; };
}, [validationKey]);

  const currentValidation = validation;
  const validationIsStale =
    validation !== null && validatedKey !== validationKey;

  const orderAssessment =
    currentValidation && orderPreview
      ? assessOrder({
          ruleStatus: currentValidation.overallStatus,
          checks: currentValidation.checks,
          side: currentValidation.side,
          sufficientCash: orderPreview.sufficientCash,
          stale: validationIsStale,
        })
      : null;

  const impactIsCurrent =
    orderPreview !== null &&
    currentValidation !== null &&
    !validationIsStale &&
    validatedKey === validationKey &&
    orderPreview.assetSymbol === selectedAsset?.symbol &&
    orderPreview.side === type &&
    orderPreview.quantity === parsedQuantity;

  const currentHoldingsValue = holdings.reduce(
    (sum, holding) => sum + holding.marketValueInPortfolioCurrency,
    0
  );

  const currentPortfolioValue =
    currentHoldingsValue + portfolio.cashBalance;

  const currentPositionValue =
    matchingHolding?.marketValueInPortfolioCurrency ?? 0;

  const estimatedTradeAmount =
    impactIsCurrent && orderPreview
      ? orderPreview.estimatedPortfolioTotal
      : null;

  const estimatedCashAfter =
    estimatedTradeAmount === null
      ? null
      : portfolio.cashBalance +
        (type === "BUY" ? -estimatedTradeAmount : estimatedTradeAmount);

  const estimatedPositionAfter =
    estimatedTradeAmount === null
      ? null
      : currentPositionValue +
        (type === "BUY" ? estimatedTradeAmount : -estimatedTradeAmount);

  const estimatedPortfolioAfter =
    estimatedCashAfter === null || estimatedPositionAfter === null
      ? null
      : currentPortfolioValue +
        (estimatedCashAfter - portfolio.cashBalance) +
        (estimatedPositionAfter - currentPositionValue);

  const impactCanBeShown =
    impactIsCurrent &&
    estimatedTradeAmount !== null &&
    estimatedCashAfter !== null &&
    estimatedPositionAfter !== null &&
    estimatedPortfolioAfter !== null &&
    Number.isFinite(currentPortfolioValue) &&
    Number.isFinite(estimatedCashAfter) &&
    Number.isFinite(estimatedPositionAfter) &&
    Number.isFinite(estimatedPortfolioAfter) &&
    currentPortfolioValue > 0 &&
    estimatedPortfolioAfter > 0 &&
    estimatedCashAfter >= 0 &&
    estimatedPositionAfter >= -0.01 &&
    (type !== "SELL" || parsedQuantity <= availableShares);

  const currentAllocation =
    currentPortfolioValue > 0
      ? (currentPositionValue / currentPortfolioValue) * 100
      : 0;

  const estimatedAllocation =
    estimatedPortfolioAfter !== null && estimatedPortfolioAfter > 0 &&
    estimatedPositionAfter !== null
      ? (Math.max(0, estimatedPositionAfter) / estimatedPortfolioAfter) * 100
      : 0;

  async function validateOrder() {
    if (
      validating ||
      submitting ||
      submissionInFlight.current ||
      !selectedAsset ||
      !validQuantity ||
      !quoteIsValid ||
      !liveQuote ||
      marketOptions.length === 0
    ) {
      return;
    }

    setPendingValidationKey(validationKey);
    setValidation(null);
    setOrderPreview(null);
    setValidatedKey(null);
    setValidationError(null);

    const requestKey = validationKey;
    const controller = new AbortController();
    validationAbortController.current = controller;

    const payload = {
      market: selectedMarket,
      side: type,
      quantity: parsedQuantity,
      price: orderType === "LIMIT" ? Number(limitPrice) : liveQuote.price,
      quantityIncrement: 1,
      ...(type === "BUY"
        ? {
            ...(portfolio.currency === selectedAsset.currency
              ? { availableCash: buyingPower ?? 0 }
              : {}),
            // Charges are unknown until the execution cost model is checked.
            // Omitting them intentionally produces NEEDS_DATA.
          }
        : {
            availableShares: Number.isSafeInteger(availableShares)
              ? availableShares
              : undefined,
          }),
    };

    try {
      const previewResponse = await fetch(
  "/api/portfolio/orders/preview",
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      assetId: selectedAsset.id,
      type,
      quantity: parsedQuantity, orderType, timeInForce, ...(orderType === "LIMIT" ? {limitPrice: Number(limitPrice)} : {}),
    }),
    cache: "no-store",
    signal: controller.signal,
  }
);

      const previewData = await previewResponse.json();

      if (!previewResponse.ok) {
        throw new Error(
          previewData.error || "Unable to preview order."
        );
      }

      const preview = previewData as OrderPreview;

      if (
        preview.assetSymbol !== selectedAsset.symbol ||
        preview.side !== type ||
        preview.quantity !== parsedQuantity ||
        preview.assetCurrency !== selectedAsset.currency ||
        preview.portfolioCurrency !== portfolio.currency ||
        !Number.isFinite(preview.estimatedPortfolioTotal) ||
        !Number.isFinite(preview.availableCash) ||
        !Number.isFinite(preview.fxRate) ||
        preview.fxRate <= 0 ||
        (type === "BUY" &&
          typeof preview.sufficientCash !== "boolean")
      ) {
        throw new Error("Order preview returned inconsistent data.");
      }

      if (latestValidationKey.current !== requestKey) {
        return;
      }

      const response = await fetch(
  "/api/ai/agents/business-rules/evaluate",
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: controller.signal,
  }
);

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Validation failed.");
      }

      if (latestValidationKey.current !== requestKey) {
        return;
      }

      const parsedEvaluation = parseRuleResult(data.evaluation);

if (
  parsedEvaluation.market !== selectedMarket ||
  parsedEvaluation.side !== type ||
  parsedEvaluation.currency !== selectedAsset.currency
) {
  throw new Error(
    "Business rules response does not match the selected order."
  );
}

setValidation(parsedEvaluation as ValidationResult);
setOrderPreview(preview);
setValidatedKey(requestKey);
    } catch (err) {
      if (latestValidationKey.current !== requestKey) {
        return;
      }

      setValidationError(
        err instanceof Error ? err.message : "Unable to validate order."
      );
    } finally {
  if (validationAbortController.current === controller) {
    validationAbortController.current = null;
    setPendingValidationKey(null);
  }
}
  }
  async function submitTrade(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (
      submitting ||
      submissionInFlight.current ||
      !selectedAsset ||
      !validQuantity ||
      !quoteIsValid
    ) {
      return;
    }

    if (portfolio.id !== DEMO_PORTFOLIO_ID) {
      setError("Trading is available for demo portfolio 1 only.");
      return;
    }

    submissionInFlight.current = true;
    setSubmitting(true);
    setMessage(null);
    setError(null);

    try {
      const result = await submitSimulatedOrder({ assetId: selectedAsset.id, type, quantity: parsedQuantity, orderType, timeInForce, ...(orderType === "LIMIT" ? {limitPrice: Number(limitPrice)} : {}) });
      setSubmittedOrder(result);

      setMessage(
        `Order #${result.id} submitted. Initial status: ${result.status}. Track execution and fills in Recent Orders.`
      );

      setQuantity("1");

    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Order failed"
      );
    } finally {
      submissionInFlight.current = false;
      setSubmitting(false);
    }
  }

  return (
    <section id="portfolio-trade-ticket" className="scroll-mt-6 rounded-xl border border-slate-800 bg-slate-900 p-6">
      <h3 className="text-xl font-semibold">Simulated Trading</h3>

      <p className="mt-2 text-sm text-slate-400">
        Submit fictional BUY and SELL orders for asynchronous execution using simulated
        market prices. Orders may partially fill, be rejected, or be cancelled.
        Final prices may differ from the preview. Cash and shares are not reserved on submission.
      </p>

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-2">
        <div className="min-w-0 rounded-xl border border-slate-700 bg-slate-950/50 p-5">
          <h4 className="mb-4 text-lg font-semibold">Trade ticket</h4>
          <p className="text-sm text-slate-300">Available buying power: {buyingPower===null?"Unavailable":formatMoney(buyingPower,portfolio.currency)}; reserved cash: {availability?formatMoney(Number(availability.reservedCash),portfolio.currency):"Unavailable"}. Available shares: {availableShares}; reserved: {Number(reservedPosition?.reserved_quantity ?? 0)}.</p>
          <form onSubmit={submitTrade} className="space-y-4">
          <label className="block">Order type <select aria-label="Order type" value={orderType} onChange={e => setOrderType(e.target.value as "MARKET" | "LIMIT")} disabled={submitting} className="bg-slate-950 p-3"><option>MARKET</option><option>LIMIT</option></select></label>
          {orderType === "LIMIT" && <label className="block">Limit price (asset currency)<input aria-label="Limit price" type="number" min="0.0001" step="0.0001" required value={limitPrice} onChange={e => setLimitPrice(e.target.value)} disabled={submitting} className="bg-slate-950 p-3" /></label>}
          <label className="block">Time in force <select aria-label="Time in force" value={timeInForce} onChange={e => setTimeInForce(e.target.value as "DAY" | "GTC")} disabled={submitting} className="bg-slate-950 p-3"><option>DAY</option><option>GTC</option></select></label>
          <p className="text-xs text-slate-400">DAY expires at midnight India time in this continuous simulated market. GTC remains until filled or cancelled.</p>
        <div>
          <label htmlFor="trade-asset" className="mb-2 block text-sm">
            Asset
          </label>

          <select
            id="trade-asset"
            value={assetId}
            onChange={(event) => setAssetId(event.target.value)}
            disabled={submitting}
            className="w-full rounded-lg border border-slate-700 bg-slate-950 p-3"
          >
            {assets.map((asset) => (
              <option key={asset.id} value={asset.id}>
                {asset.symbol} - {asset.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="trade-market" className="mb-2 block text-sm">
            Exchange for simulated validation
          </label>
          <select
            id="trade-market"
            value={selectedMarket}
            onChange={(event) => setMarket(event.target.value as Market)}
            disabled={submitting || validating || marketOptions.length === 0}
            className="w-full rounded-lg border border-slate-700 bg-slate-950 p-3"
          >
            {marketOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-slate-400">
            Exchange selection is for hypothetical validation only.
            PortfolioLab does not yet store exchange metadata per asset.
          </p>
        </div>
        <div>
          <label htmlFor="trade-type" className="mb-2 block text-sm">
            Order Type
          </label>

          <select
            id="trade-type"
            value={type}
            onChange={(event) =>
              setType(event.target.value as "BUY" | "SELL")
            }
            disabled={submitting}
            className="w-full rounded-lg border border-slate-700 bg-slate-950 p-3"
          >
            <option value="BUY">BUY</option>
            <option value="SELL">SELL</option>
          </select>
        </div>

        <div>
          <label htmlFor="trade-quantity" className="mb-2 block text-sm">
            Quantity
          </label>

          <input
            id="trade-quantity"
            type="number"
            min="1"
            step="1"
            required
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
            disabled={submitting}
            className="w-full rounded-lg border border-slate-700 bg-slate-950 p-3"
          />
        </div>

        {quoteIsValid && liveQuote && (
          <p className="text-sm text-slate-300">
            Live simulated price:{" "}
            {formatMoney(liveQuote.price, liveQuote.currency)}
          </p>
        )}

        {estimatedTotal !== null && selectedAsset && (
          <p className="text-sm text-slate-300">
            Estimated order value:{" "}
            {formatMoney(estimatedTotal, selectedAsset.currency)}
          </p>
        )}

        {!quoteIsValid && (
          <p className="text-sm text-amber-400">
            Waiting for a valid live simulated market price.
          </p>
        )}

        <div>
          <button
            type="button"
            onClick={() => void validateOrder()}
            disabled={
              validating ||
              submitting ||
              !selectedAsset ||
              !validQuantity ||
              !quoteIsValid ||
              marketOptions.length === 0
            }
            className="rounded-lg border border-emerald-400 px-6 py-3 font-semibold text-emerald-300 transition hover:bg-emerald-400/10 disabled:opacity-50"
          >
            {validating ? "Validating..." : "Validate Order"}
          </button>
        </div>
        <button
          type="submit"
          disabled={
            submitting ||
            !selectedAsset ||
            !validQuantity ||
            !quoteIsValid
          }
          className="rounded-lg bg-emerald-500 px-6 py-3 font-semibold text-slate-950 disabled:opacity-50"
        >
          {submitting ? "Submitting..." : `Submit ${type}`}
        </button>
          </form>
        </div>

        <div className="min-w-0 space-y-4">
          <div className="rounded-xl border border-slate-700 bg-slate-950/50 p-5">
            <h4 className="text-lg font-semibold">Order review</h4>
            <p className="mt-2 text-sm text-slate-400">
              Validate an order to inspect estimated costs, buying power,
              and simulated market rules.
            </p>
          </div>

      {validationError && (
        <p role="alert" className="mt-4 text-sm text-red-400">
          {validationError}
        </p>
      )}

      {currentValidation && orderPreview && (
        <div className="space-y-3 rounded-xl border border-slate-700 bg-slate-950 p-4">
          <div className="flex items-center justify-between gap-3">
            <h4 className="font-semibold">
              Order Review
              {validationIsStale && (
                <span className="ml-2 text-xs font-normal text-amber-300">
                  (Outdated - validate again)
                </span>
              )}
            </h4>
            <span
              className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                orderAssessment?.status === "NOT_READY"
                  ? "border-red-500/40 text-red-300"
                  : orderAssessment?.status === "READY_FOR_SUBMISSION"
                    ? "border-emerald-500/40 text-emerald-300"
                    : "border-amber-500/40 text-amber-300"
              }`}
            >
              {orderAssessment?.status.replaceAll("_", " ")}
            </span>
          </div>

          <p className="text-xs text-slate-400">
            {currentValidation.market} · {currentValidation.side} ·{" "}
            {currentValidation.currency}
          </p>

          {orderAssessment && (
            <div className="space-y-2 rounded-lg border border-slate-700 bg-slate-900 p-3">
              <p className="text-sm font-medium">
                {orderAssessment.reason}
              </p>
              <p className="text-xs text-slate-400">
                Business Rules Agent:{" "}
                {currentValidation.overallStatus}
              </p>
              <p className="text-xs text-slate-400">
                Buying power:{" "}
                {currentValidation.side === "BUY"
                  ? orderPreview.sufficientCash === true
                    ? "Sufficient"
                    : orderPreview.sufficientCash === false
                      ? "Insufficient"
                      : "Unknown"
                  : "Not applicable to SELL"}
              </p>
            </div>
          )}

          <div className="space-y-2 border-t border-slate-800 pt-3">
            <h5 className="text-sm font-semibold">
              Estimated order cost
            </h5>
            <p className="text-sm text-slate-300">
              Estimated asset cost:{" "}
              {formatMoney(
                orderPreview.estimatedAssetTotal,
                orderPreview.assetCurrency
              )}
            </p>
            <p className="text-sm text-slate-300">
              Reference FX rate:{" "}
              {orderPreview.fxRate.toFixed(6)}{" "}
              {orderPreview.portfolioCurrency} per{" "}
              {orderPreview.assetCurrency}
            </p>
            <p className="text-sm text-slate-300">
              Estimated portfolio cost:{" "}
              {formatMoney(
                orderPreview.estimatedPortfolioTotal,
                orderPreview.portfolioCurrency
              )}
            </p>
            {type === "BUY" && (
              <>
                <p className="text-sm text-slate-300">
                  Available cash:{" "}
                  {formatMoney(
                    orderPreview.availableCash,
                    orderPreview.portfolioCurrency
                  )}
                </p>
                <p
                  className={
                    orderPreview.sufficientCash
                      ? "text-sm text-emerald-300"
                      : "text-sm text-red-300"
                  }
                >
                  Buying power:{" "}
                  {orderPreview.sufficientCash
                    ? "Sufficient"
                    : "Insufficient"}
                </p>
              </>
            )}
            <p className="text-xs text-slate-500">
              {orderPreview.disclaimer}
            </p>
          </div>

          {impactCanBeShown && selectedAsset && estimatedCashAfter !== null && (
            <div className="rounded-lg border border-slate-700 bg-slate-900 p-4">
              <h5 className="font-semibold">Estimated portfolio impact</h5>
              <p className="mt-1 text-xs text-slate-400">
                Hypothetical change if this simulated order executes at the
                previewed amount.
              </p>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs text-slate-400">Available cash</p>
                  <p className="mt-1 text-sm tabular-nums text-slate-300">
                    {formatMoney(portfolio.cashBalance, portfolio.currency)}
                  </p>
                  <p className="mt-1 font-semibold tabular-nums text-emerald-300">
                    → {formatMoney(estimatedCashAfter, portfolio.currency)}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-slate-400">
                    {selectedAsset.symbol} allocation
                  </p>
                  <p className="mt-1 text-sm tabular-nums text-slate-300">
                    {currentAllocation.toFixed(1)}%
                  </p>
                  <p className="mt-1 font-semibold tabular-nums text-emerald-300">
                    → {estimatedAllocation.toFixed(1)}%
                  </p>
                </div>
              </div>

              <p className="mt-4 text-xs leading-5 text-slate-500">
                Illustrative allocation using current portfolio valuations and
                the backend&apos;s estimated trade amount. Execution prices, FX,
                charges, and portfolio values may differ. No trade is executed
                by this preview.
              </p>
            </div>
          )}

          <details className="rounded-lg border border-slate-800 bg-slate-900/50">
            <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-slate-200 hover:text-emerald-300">
              Detailed market-rule checks ({currentValidation.checks.length})
            </summary>

            <div className="space-y-3 border-t border-slate-800 px-4 py-3">
              {currentValidation.checks.map((check) => (
                <div
                  key={check.code}
                  className="border-b border-slate-800 pb-3 last:border-b-0 last:pb-0"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">
                      {check.code.replaceAll("_", " ")}
                    </span>
                    <span
                      className={`text-xs font-semibold ${
                        check.status === "FAIL"
                          ? "text-red-300"
                          : check.status === "PASS"
                            ? "text-emerald-300"
                            : "text-amber-300"
                      }`}
                    >
                      {check.status.replaceAll("_", " ")}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-400">
                    {check.explanation}
                  </p>
                </div>
              ))}
            </div>
          </details>

          <p className="text-xs leading-5 text-slate-500">
            {currentValidation.disclaimer}
          </p>
          <p className="text-xs text-amber-300">
            Validation is informational and does not reserve cash,
            lock a price, or execute an order.
          </p>
        </div>
      )}
        </div>
      </div>

      {message && (
        <p role="status" className="mt-4 text-sm text-emerald-400">
          {message}
        </p>
      )}

      {error && (
        <p role="alert" className="mt-4 text-sm text-red-400">
          {error}
        </p>
      )}
      <RecentOrders submittedOrder={submittedOrder} onOrdersChanged={onTradeCompleted} assets={assets} />
    </section>
  );
}
