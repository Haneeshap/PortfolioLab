"use client";

import { useEffect, useState } from "react";
import { useMarketPrices } from "./MarketPriceProvider";

type Asset = {
  id: number;
  symbol: string;
  name: string;
  price: number;
  currency: string;
};

type TradeFormProps = {
  assets: Asset[];
  onTradeCompleted: () => Promise<void>;
};

type OrderResult = {
  pricePerUnit: number;
  totalAmount: number;
  currency: string;
};

export default function TradeForm({
  assets,
  onTradeCompleted,
}: TradeFormProps) {
  const { prices, status } = useMarketPrices();

  const [assetId, setAssetId] = useState("1");
  const [type, setType] = useState<"BUY" | "SELL">("BUY");
  const [quantity, setQuantity] = useState("1");
  const [submitting, setSubmitting] = useState(false);
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
        throw new Error(
          `Order rejected (${response.status}): ${body.slice(0, 300)}`
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

      <form onSubmit={submitTrade} className="mt-6 space-y-4">
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