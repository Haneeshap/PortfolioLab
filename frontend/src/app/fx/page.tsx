"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";

type AttributionResult = {
  originalValue: number;
  currentValue: number;
  assetImpact: number;
  fxImpact: number;
  netChange: number;
  returnPercent: number;
};

type ReferenceRate = {
  date: string;
  base: string;
  quote: string;
  rate: number;
};

type Values = {
  quantity: string;
  purchasePrice: string;
  currentPrice: string;
  purchaseFxRate: string;
  currentFxRate: string;
};

const currencies = ["USD", "EUR", "INR", "GBP", "JPY", "AUD", "CAD", "CHF"];

const fields: { key: keyof Values; label: string }[] = [
  { key: "quantity", label: "Asset quantity" },
  { key: "purchasePrice", label: "Purchase price" },
  { key: "currentPrice", label: "Current price" },
];

function formatMoney(value: number, code: string) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: code,
    maximumFractionDigits: 2,
  }).format(value);
}

export default function FxAnalyticsPage() {
  const [from, setFrom] = useState("USD");
  const [to, setTo] = useState("INR");
  const [purchaseDate, setPurchaseDate] = useState("2026-09-01");

  const [values, setValues] = useState<Values>({
    quantity: "1",
    purchasePrice: "100",
    currentPrice: "110",
    purchaseFxRate: "",
    currentFxRate: "",
  });

  const [rateMode, setRateMode] = useState<"automatic" | "manual">("automatic");
  const [historical, setHistorical] = useState<ReferenceRate | null>(null);
  const [latest, setLatest] = useState<ReferenceRate | null>(null);
  const [ratesLoading, setRatesLoading] = useState(false);
  const [ratesError, setRatesError] = useState("");
  const [result, setResult] = useState<AttributionResult | null>(null);
  const [calculating, setCalculating] = useState(false);
  const [error, setError] = useState("");

  const loadRates = useCallback(async (signal?: AbortSignal) => {
    setRatesLoading(true);
    setRatesError("");
    setHistorical(null);
    setLatest(null);
    setResult(null);

    try {
      const base = new URLSearchParams({ from, to });
      const past = new URLSearchParams({
        from,
        to,
        date: purchaseDate,
      });

      const [pastResponse, latestResponse] = await Promise.all([
        fetch(`/api/fx/reference?${past}`, {
          cache: "no-store",
          signal,
        }),
        fetch(`/api/fx/reference?${base}`, {
          cache: "no-store",
          signal,
        }),
      ]);

      if (!pastResponse.ok || !latestResponse.ok) {
        throw new Error(
          `Rate retrieval failed (HTTP ${!pastResponse.ok ? pastResponse.status : latestResponse.status})`
        );
      }

      const [pastData, latestData]: [ReferenceRate, ReferenceRate] =
        await Promise.all([
          pastResponse.json(),
          latestResponse.json(),
        ]);

      if (signal?.aborted) return;

      if (
        !Number.isFinite(pastData.rate) ||
        !Number.isFinite(latestData.rate) ||
        pastData.rate <= 0 ||
        latestData.rate <= 0
      ) {
        throw new Error("The rate provider returned invalid data.");
      }

      setHistorical(pastData);
      setLatest(latestData);

      setValues((previous) => ({
        ...previous,
        purchaseFxRate: String(pastData.rate),
        currentFxRate: String(latestData.rate),
      }));
    } catch (err) {
      if (signal?.aborted) return;

      setRatesError(
        err instanceof Error ? err.message : "Unable to retrieve rates."
      );

      setValues((previous) => ({
        ...previous,
        purchaseFxRate: "",
        currentFxRate: "",
      }));
    } finally {
      if (!signal?.aborted) setRatesLoading(false);
    }
  }, [from, to, purchaseDate]);

  useEffect(() => {
    if (rateMode !== "automatic") return;

    const controller = new AbortController();
    void loadRates(controller.signal);

    return () => controller.abort();
  }, [loadRates, rateMode]);

  function updateValue(key: keyof Values, value: string) {
    setValues((previous) => ({
      ...previous,
      [key]: value,
    }));
    setResult(null);
  }

  async function calculate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setResult(null);

    const payload = Object.fromEntries(
      Object.entries(values).map(([key, value]) => [
        key,
        Number(value),
      ])
    );

    if (
      Object.values(values).some((value) => value.trim() === "") ||
      Object.values(payload).some(
        (value) => !Number.isFinite(value) || value <= 0
      )
    ) {
      setError("Enter valid positive values before calculating.");
      return;
    }

    if (rateMode === "automatic" && (!historical || !latest)) {
      setError("Wait for the reference rates to load.");
      return;
    }

    setCalculating(true);

    try {
      const response = await fetch("/api/fx/attribution", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Calculation failed (HTTP ${response.status})`);
      }

      setResult(await response.json());
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Calculation failed."
      );
    } finally {
      setCalculating(false);
    }
  }

  const ratesReady = rateMode === "manual" || (!!historical && !!latest);

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm font-medium text-emerald-400">
          CURRENCY INTELLIGENCE
        </p>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight">
          FX Impact Analysis
        </h2>
        <p className="mt-3 max-w-2xl text-sm text-slate-400">
          Separate asset performance from currency movements using
          historical and latest available reference exchange rates.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        <form
          onSubmit={calculate}
          className="space-y-5 rounded-2xl border border-slate-800 bg-slate-900 p-6"
        >
          <div>
            <h3 className="text-lg font-semibold">
              Investment scenario
            </h3>
            <p className="mt-1 text-xs text-slate-400">
              Analyze a hypothetical international investment.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-2 block text-sm text-slate-300">
                Asset currency
              </span>
              <select
                value={from}
                onChange={(event) => {
                  setFrom(event.target.value);
                  setResult(null);
                }}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-white"
              >
                {currencies.map((code) => (
                  <option key={code} value={code}>{code}</option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm text-slate-300">
                Reporting currency
              </span>
              <select
                value={to}
                onChange={(event) => {
                  setTo(event.target.value);
                  setResult(null);
                }}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-white"
              >
                {currencies.map((code) => (
                  <option key={code} value={code}>{code}</option>
                ))}
              </select>
            </label>
          </div>

          <label className="block">
            <span className="mb-2 block text-sm text-slate-300">
              Purchase date
            </span>
            <input
              type="date"
              value={purchaseDate}
              
              onChange={(event) => {
                setPurchaseDate(event.target.value);
                setResult(null);
              }}
              required
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white"
            />
          </label>

          {fields.map((field) => (
            <label key={field.key} className="block">
              <span className="mb-2 block text-sm text-slate-300">
                {field.label} {field.key !== "quantity" ? `(${from})` : ""}
              </span>
              <input
                type="number"
                min="0.00000001"
                step="any"
                required
                value={values[field.key]}
                onChange={(event) =>
                  updateValue(field.key, event.target.value)
                }
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-emerald-500"
              />
            </label>
          ))}

          <div className="border-t border-slate-800 pt-5">
            <div className="mb-3 flex items-center justify-between">
              <h4 className="text-sm font-semibold">
                Exchange rates
              </h4>
              <span className="text-xs text-slate-500">
                {rateMode === "automatic" ? "Auto-fetched" : "Custom"}
              </span>
            </div>

            <div className="mb-4 flex gap-2">
              {(["automatic", "manual"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => {
                    setRateMode(mode);
                    setResult(null);
                  }}
                  className={`rounded-lg px-3 py-2 text-xs font-medium ${
                    rateMode === mode
                      ? "bg-emerald-500 text-slate-950"
                      : "border border-slate-700 text-slate-300"
                  }`}
                >
                  {mode === "automatic" ? "Automatic" : "Manual"}
                </button>
              ))}
            </div>

            {ratesLoading && rateMode === "automatic" && (
              <p className="mb-3 text-xs text-slate-400">
                Retrieving reference rates...
              </p>
            )}

            {ratesError && rateMode === "automatic" && (
              <div role="alert" className="mb-3 space-y-2">
                <p className="text-xs text-red-400">{ratesError}</p>
                <button
                  type="button"
                  onClick={() => void loadRates()}
                  className="text-xs font-medium text-emerald-400 underline"
                >
                  Retry retrieval
                </button>
              </div>
            )}

            {([
              ["purchaseFxRate", "Purchase-date rate"],
              ["currentFxRate", "Latest available rate"],
            ] as const).map(([key, label]) => (
              <label key={key} className="mb-3 block">
                <span className="mb-2 block text-sm text-slate-300">
                  {label} ({from}/{to})
                </span>
                <input
                  type="number"
                  min="0.00000001"
                  step="any"
                  required
                  readOnly={rateMode === "automatic"}
                  value={values[key]}
                  onChange={(event) =>
                    updateValue(key, event.target.value)
                  }
                  className={`w-full rounded-lg border border-slate-700 px-4 py-3 text-sm text-white ${
                    rateMode === "automatic"
                      ? "bg-slate-800 text-slate-300"
                      : "bg-slate-950 focus:border-emerald-500"
                  }`}
                />
              </label>
            ))}

            {rateMode === "automatic" && historical && latest && (
              <p className="text-xs leading-5 text-slate-400">
                Historical rate: {historical.date}
                <br />
                Latest available: {latest.date}
                <br />
                Source: Frankfurter daily reference rates
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={calculating || ratesLoading || !ratesReady}
            className="w-full rounded-lg bg-emerald-500 px-4 py-3 font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:opacity-50"
          >
            {calculating ? "Calculating..." : "Analyze FX impact"}
          </button>
        </form>

        <section className="space-y-6">
          {!result && !error && (
            <div className="flex min-h-80 items-center justify-center rounded-2xl border border-dashed border-slate-700 bg-slate-900/40 p-8 text-center">
              <div>
                <p className="text-lg font-medium text-slate-200">
                  Ready to analyze
                </p>
                <p className="mt-2 text-sm text-slate-400">
                  Select currencies and a purchase date.
                  Exchange rates will be retrieved automatically.
                </p>
              </div>
            </div>
          )}

          {error && (
            <div
              role="alert"
              className="rounded-xl border border-red-500/30 bg-red-500/10 p-5 text-sm text-red-300"
            >
              {error}
            </div>
          )}

          {result && (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <Metric
                  label="Original investment"
                  value={formatMoney(result.originalValue, to)}
                />
                <Metric
                  label="Current investment"
                  value={formatMoney(result.currentValue, to)}
                />
                <Metric
                  label="Asset price impact"
                  value={formatMoney(result.assetImpact, to)}
                  tone={result.assetImpact >= 0 ? "positive" : "negative"}
                />
                <Metric
                  label="Currency impact"
                  value={formatMoney(result.fxImpact, to)}
                  tone={result.fxImpact >= 0 ? "positive" : "negative"}
                />
              </div>

              <div className="rounded-2xl border border-emerald-500/20 bg-slate-900 p-6">
                <p className="text-sm text-slate-400">
                  Net investment change
                </p>
                <p
                  className={`mt-3 text-3xl font-bold ${
                    result.netChange >= 0
                      ? "text-emerald-400"
                      : "text-red-400"
                  }`}
                >
                  {formatMoney(result.netChange, to)}
                </p>
                <p className="mt-2 text-sm text-slate-400">
                  Total return: {result.returnPercent.toFixed(2)}%
                </p>
              </div>
            </>
          )}
        </section>
      </div>

      <p className="text-xs text-slate-500">
        Educational investment simulation. Exchange rates are
        daily reference data, not executable market quotes.
        Calculations exclude fees, taxes and spreads.
      </p>
    </div>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "positive" | "negative";
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
      <p className="text-sm text-slate-400">{label}</p>
      <p
        className={`mt-3 text-xl font-semibold ${
          tone === "positive"
            ? "text-emerald-400"
            : tone === "negative"
              ? "text-red-400"
              : "text-white"
        }`}
      >
        {value}
      </p>
    </div>
  );
}