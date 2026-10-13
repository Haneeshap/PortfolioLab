"use client";

import { useState, type FormEvent } from "react";

type Market = "NSE" | "BSE" | "NYSE" | "NASDAQ";
type Side = "BUY" | "SELL";
type Status = "PASS" | "FAIL" | "NEEDS_DATA";

type RuleCheck = {
  code: string;
  status: Status;
  explanation: string;
};

type Evaluation = {
  market: Market;
  currency: string;
  side: Side;
  overallStatus: Status;
  checks: RuleCheck[];
  disclaimer: string;
};

const inputStyle =
  "mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none transition focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400";

const labelStyle = "block text-sm font-medium text-slate-300";

const statusStyle: Record<Status, string> = {
  PASS: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  FAIL: "border-red-500/30 bg-red-500/10 text-red-300",
  NEEDS_DATA: "border-amber-500/30 bg-amber-500/10 text-amber-300"
};

const ruleNames: Record<string, string> = {
  BUYING_POWER: "Buying power",
  SELL_AVAILABILITY: "Available shares",
  PRICE_RESTRICTIONS: "Price restrictions",
  QUANTITY_INCREMENT: "Quantity requirements"
};

function optionalNumber(value: string): number | undefined {
  return value.trim() === "" ? undefined : Number(value);
}

export default function BusinessRulesAgent() {
  const [market, setMarket] = useState<Market>("NSE");
  const [side, setSide] = useState<Side>("BUY");
  const [quantity, setQuantity] = useState("10");
  const [price, setPrice] = useState("250");
  const [availableCash, setAvailableCash] = useState("3000");
  const [availableShares, setAvailableShares] = useState("25");
  const [estimatedCharges, setEstimatedCharges] = useState("20");
  const [lowerPriceLimit, setLowerPriceLimit] = useState("");
  const [upperPriceLimit, setUpperPriceLimit] = useState("");
  const [quantityIncrement, setQuantityIncrement] = useState("1");

  const [result, setResult] = useState<Evaluation | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const currency = market === "NSE" || market === "BSE" ? "INR" : "USD";
  const symbol = currency === "INR" ? "₹" : "$";

  async function evaluate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setResult(null);

    const values = {
      quantity: Number(quantity),
      price: Number(price),
      availableCash: optionalNumber(availableCash),
      availableShares: optionalNumber(availableShares),
      estimatedCharges: optionalNumber(estimatedCharges),
      lowerPriceLimit: optionalNumber(lowerPriceLimit),
      upperPriceLimit: optionalNumber(upperPriceLimit),
      quantityIncrement: optionalNumber(quantityIncrement)
    };

    const positive = (n: number) => Number.isFinite(n) && n > 0;
    const nonnegative = (n: number) => Number.isFinite(n) && n >= 0;
    const optional = (
      n: number | undefined,
      test: (value: number) => boolean
    ) => n === undefined || test(n);

    const valid =
      Number.isSafeInteger(values.quantity) &&
      values.quantity > 0 &&
      positive(values.price) &&
      optional(values.availableCash, nonnegative) &&
      optional(values.availableShares, (n) =>
        Number.isSafeInteger(n) && n >= 0
      ) &&
      optional(values.estimatedCharges, nonnegative) &&
      optional(values.lowerPriceLimit, positive) &&
      optional(values.upperPriceLimit, positive) &&
      optional(values.quantityIncrement, (n) =>
        Number.isSafeInteger(n) && n > 0
      ) &&
      (
        values.lowerPriceLimit === undefined ||
        values.upperPriceLimit === undefined ||
        values.lowerPriceLimit <= values.upperPriceLimit
      );

    if (!valid) {
      setError("Please enter valid quantities, prices, and optional limits.");
      return;
    }

    const payload = {
      market,
      side,
      quantity: values.quantity,
      price: values.price,
      ...(side === "BUY"
        ? {
            availableCash: values.availableCash,
            estimatedCharges: values.estimatedCharges
          }
        : {
            availableShares: values.availableShares
          }),
      lowerPriceLimit: values.lowerPriceLimit,
      upperPriceLimit: values.upperPriceLimit,
      quantityIncrement: values.quantityIncrement
    };

    setLoading(true);

    try {
      const response = await fetch(
        "/api/ai/agents/business-rules/evaluate",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Evaluation failed.");
      }

      setResult(data.evaluation as Evaluation);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to evaluate transaction."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-sm">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-white">
          Business Rules Agent
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          Evaluate a hypothetical equity transaction against simulated
          market rules. Supports Indian and US market profiles.
        </p>
      </div>

      <form onSubmit={evaluate} className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className={labelStyle}>
            Stock exchange
            <select
              className={inputStyle}
              value={market}
              onChange={(event) => {
                setMarket(event.target.value as Market);
                setResult(null);
              }}
            >
              <option value="NSE">NSE — India</option>
              <option value="BSE">BSE — India</option>
              <option value="NYSE">NYSE — United States</option>
              <option value="NASDAQ">Nasdaq — United States</option>
            </select>
          </label>

          <label className={labelStyle}>
            Transaction
            <select
              className={inputStyle}
              value={side}
              onChange={(event) => {
                setSide(event.target.value as Side);
                setResult(null);
              }}
            >
              <option value="BUY">BUY</option>
              <option value="SELL">SELL</option>
            </select>
          </label>

          <label className={labelStyle}>
            Quantity (shares)
            <input
              className={inputStyle}
              type="number"
              min="1"
              step="1"
              required
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
            />
          </label>

          <label className={labelStyle}>
            Order price ({symbol})
            <input
              className={inputStyle}
              type="number"
              min="0.000001"
              step="any"
              required
              value={price}
              onChange={(event) => setPrice(event.target.value)}
            />
          </label>

          {side === "BUY" ? (
            <>
              <label className={labelStyle}>
                Available cash ({symbol})
                <input
                  className={inputStyle}
                  type="number"
                  min="0"
                  step="any"
                  placeholder="Unknown"
                  value={availableCash}
                  onChange={(event) => setAvailableCash(event.target.value)}
                />
              </label>

              <label className={labelStyle}>
                Estimated charges ({symbol})
                <input
                  className={inputStyle}
                  type="number"
                  min="0"
                  step="any"
                  placeholder="Unknown"
                  value={estimatedCharges}
                  onChange={(event) => setEstimatedCharges(event.target.value)}
                />
              </label>
            </>
          ) : (
            <label className={labelStyle}>
              Available shares
              <input
                className={inputStyle}
                type="number"
                min="0"
                step="1"
                placeholder="Unknown"
                value={availableShares}
                onChange={(event) => setAvailableShares(event.target.value)}
              />
            </label>
          )}
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
          <h3 className="text-sm font-semibold text-white">
            Optional security-specific restrictions
          </h3>
          <p className="mt-1 text-xs leading-5 text-slate-400">
            Enter limits only when you have a hypothetical or verified
            security-specific rule set. These are not fetched from an exchange.
            US market restrictions are not equivalent to Indian daily price bands.
          </p>

          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <label className={labelStyle}>
              Lower price limit
              <input
                className={inputStyle}
                type="number"
                min="0.000001"
                step="any"
                placeholder="Not supplied"
                value={lowerPriceLimit}
                onChange={(event) => setLowerPriceLimit(event.target.value)}
              />
            </label>

            <label className={labelStyle}>
              Upper price limit
              <input
                className={inputStyle}
                type="number"
                min="0.000001"
                step="any"
                placeholder="Not supplied"
                value={upperPriceLimit}
                onChange={(event) => setUpperPriceLimit(event.target.value)}
              />
            </label>

            <label className={labelStyle}>
              Quantity increment
              <input
                className={inputStyle}
                type="number"
                min="1"
                step="1"
                placeholder="Default: 1"
                value={quantityIncrement}
                onChange={(event) => setQuantityIncrement(event.target.value)}
              />
            </label>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="cursor-pointer rounded-lg bg-emerald-400 px-5 py-2.5 text-sm font-semibold text-slate-950 shadow-sm transition-all hover:bg-emerald-300 hover:shadow-md active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Evaluating..." : "Evaluate Market Rules"}
        </button>
      </form>

      {error && (
        <p
          role="alert"
          className="mt-5 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300"
        >
          {error}
        </p>
      )}

      {result && (
        <div className="mt-6 space-y-4 border-t border-slate-800 pt-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-semibold text-white">
                Evaluation results
              </h3>
              <p className="mt-1 text-xs text-slate-400">
                {result.market} · {result.side} · {result.currency}
              </p>
            </div>
            <span
              className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                statusStyle[result.overallStatus]
              }`}
            >
              {result.overallStatus === "NEEDS_DATA"
                ? "NEEDS DATA"
                : result.overallStatus}
            </span>
          </div>

          <div className="space-y-3">
            {result.checks.map((check) => (
              <div
                key={check.code}
                className="rounded-xl border border-slate-800 bg-slate-950/70 p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="text-sm font-semibold text-white">
                    {ruleNames[check.code] ??
                      check.code.replaceAll("_", " ")}
                  </h4>
                  <span
                    className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${
                      statusStyle[check.status]
                    }`}
                  >
                    {check.status === "NEEDS_DATA"
                      ? "NEEDS DATA"
                      : check.status}
                  </span>
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  {check.explanation}
                </p>
              </div>
            ))}
          </div>

          <p className="text-xs leading-5 text-slate-500">
            {result.disclaimer}
          </p>
        </div>
      )}
    </section>
  );
}