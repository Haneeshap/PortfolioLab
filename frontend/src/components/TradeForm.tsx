"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useMarketPrices } from "./MarketPriceProvider";
import type { Portfolio, Holding } from "./usePortfolioData";
import { assessOrder, parseRuleResult } from "./orderAssessment";
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

type OrderResult = {
  pricePerUnit: number;
  totalAmount: number;
  currency: string;
};

export default function TradeForm({
  assets,
  portfolio,
  holdings,
  onTradeCompleted,
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

  useEffect(() => {
    if (
      requestedAssetId &&
      assets.some((asset) => String(asset.id) === requestedAssetId)
    ) {
      setAssetId(requestedAssetId);
    }
  }, [requestedAssetId, assets]);
  const [type, setType] = useState<"BUY" | "SELL">("BUY");
  const [quantity, setQuantity] = useState("1");
  const [submitting, setSubmitting] = useState(false);
  const [market, setMarket] = useState<Market>("NSE");
  const [validating, setValidating] = useState(false);
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

  const availableShares = matchingHolding?.quantity ?? 0;

  const validationKey = JSON.stringify({
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

    portfolioCash: portfolio.cashBalance,
    portfolioCurrency: portfolio.currency,
    availableShares,
  });

  const [validatedKey, setValidatedKey] = useState<string | null>(null);

  const latestValidationKey = useRef(validationKey);
  const validationAbortController = useRef<AbortController | null>(null);

  useLayoutEffect(() => {
  latestValidationKey.current = validationKey;

  validationAbortController.current?.abort();
  validationAbortController.current = null;
  setValidating(false);
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

  async function validateOrder() {
    if (
      validating ||
      submitting ||
      !selectedAsset ||
      !validQuantity ||
      !quoteIsValid ||
      !liveQuote ||
      marketOptions.length === 0
    ) {
      return;
    }

    setValidating(true);
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
      price: liveQuote.price,
      quantityIncrement: 1,
      ...(type === "BUY"
        ? {
            ...(portfolio.currency === selectedAsset.currency
              ? { availableCash: portfolio.cashBalance }
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
      quantity: parsedQuantity,
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
    setValidating(false);
  }
}
  }
  async function submitTrade(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (
      submitting ||
      !selectedAsset ||
      !validQuantity ||
      !quoteIsValid
    ) {
      return;
    }

    setSubmitting(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch("/api/portfolio/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assetId: selectedAsset.id,
          type,
          quantity: parsedQuantity,
        }),
      });

      if (!response.ok) {
        const body = await response.text();

        if (
          response.status === 400 &&
          body.includes("Insufficient virtual cash")
        ) {
          throw new Error(
            "Insufficient simulated cash for this order. Reduce the quantity or choose a less expensive asset."
          );
        }

        throw new Error(
          `Unable to execute this simulated order (${response.status}). Please review the order details and try again.`
        );
      }

      const result: OrderResult = await response.json();

      setMessage(
        `${type} executed: ${parsedQuantity} ${selectedAsset.symbol} at ${formatMoney(result.pricePerUnit, result.currency)} per unit. Total: ${formatMoney(result.totalAmount, result.currency)}.`
      );

      setQuantity("1");

      try {
        await onTradeCompleted();
      } catch {
        setError(
          "Order executed, but the portfolio could not refresh. Check transaction history before placing another order."
        );
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Order failed"
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900 p-6">
      <h3 className="text-xl font-semibold">Simulated Trading</h3>

      <p className="mt-2 text-sm text-slate-400">
        Execute fictional BUY and SELL orders using live simulated
        market prices. Final execution prices may differ slightly
        from the estimate.
      </p>

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-2">
        <div className="min-w-0 rounded-xl border border-slate-700 bg-slate-950/50 p-5">
          <h4 className="mb-4 text-lg font-semibold">Trade ticket</h4>
          <form onSubmit={submitTrade} className="space-y-4">
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
          {submitting ? "Processing..." : `Execute ${type}`}
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
    </section>
  );
}