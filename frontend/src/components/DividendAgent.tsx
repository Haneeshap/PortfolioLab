"use client";

import { useState } from "react";

type Currency = "INR" | "USD" | "EUR";

type DividendSimulation = {
  eligibleShares: number;
  dividendPerShare: number;
  grossDividend: number;
  currency: Currency;
  calculation: string;
  disclaimer: string;
};

export default function DividendAgent() {
  const [shares, setShares] = useState("50");
  const [rate, setRate] = useState("5");
  const [currency, setCurrency] = useState<Currency>("INR");
  const [result, setResult] = useState<DividendSimulation | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function simulate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setResult(null);

    const eligibleShares = Number(shares);
    const dividendPerShare = Number(rate);

    if (
      !shares.trim() ||
      !rate.trim() ||
      !Number.isSafeInteger(eligibleShares) ||
      eligibleShares < 0 ||
      !Number.isFinite(dividendPerShare) ||
      dividendPerShare < 0
    ) {
      setError("Enter valid non-negative shares and dividend amounts.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        "/api/ai/agents/dividend/simulate",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            eligibleShares,
            dividendPerShare,
            currency
          })
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Simulation failed");
      }

      if (
        data.agent !== "dividend" ||
        data.mode !== "read-only" ||
        typeof data.simulation?.grossDividend !== "number" ||
        typeof data.simulation?.calculation !== "string" ||
        typeof data.simulation?.disclaimer !== "string"
      ) {
        throw new Error("Unexpected simulation response");
      }

      setResult(data.simulation);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Unable to complete the simulation"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-2xl border border-emerald-500/20 bg-slate-900 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
            Corporate Actions
          </p>

          <h3 className="mt-2 text-xl font-semibold text-white">
            Dividend Agent
          </h3>

          <p className="mt-2 max-w-xl text-sm leading-6 text-slate-400">
            Estimate a hypothetical gross dividend using an assumed
            eligible share quantity and dividend rate.
          </p>
        </div>

        <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-400">
          Available · Read-only
        </span>
      </div>

      <form onSubmit={simulate} className="mt-7 space-y-5">
        <div className="grid gap-5 md:grid-cols-3">
          <label className="block">
            <span className="mb-2 block text-sm text-slate-300">
              Assumed eligible shares
            </span>

            <input
              type="number"
              min="0"
              step="1"
              required
              value={shares}
              onChange={(event) => setShares(event.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-emerald-500"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm text-slate-300">
              Dividend per share
            </span>

            <input
              type="number"
              min="0"
              step="any"
              required
              value={rate}
              onChange={(event) => setRate(event.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-emerald-500"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm text-slate-300">
              Currency
            </span>

            <select
              value={currency}
              onChange={(event) =>
                setCurrency(event.target.value as Currency)
              }
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-emerald-500"
            >
              <option value="INR">INR — Indian Rupee</option>
              <option value="USD">USD — US Dollar</option>
              <option value="EUR">EUR — Euro</option>
            </select>
          </label>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-emerald-500 px-5 py-3 text-sm font-semibold text-slate-950 transition-colors hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Calculating..." : "Simulate Dividend"}
        </button>
      </form>

      {error && (
        <div role="alert" className="mt-6 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
          {error}
        </div>
      )}

      {result && (
        <div aria-live="polite" className="mt-7 rounded-xl border border-slate-700 bg-slate-950 p-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Simulated gross dividend
          </p>

          <p className="mt-3 text-3xl font-bold tracking-tight text-white">
            {new Intl.NumberFormat("en-IN", {
              style: "currency",
              currency: result.currency
            }).format(result.grossDividend)}
          </p>

          <p className="mt-3 text-sm text-slate-300">
            {result.calculation}
          </p>

          <p className="mt-5 border-t border-slate-800 pt-4 text-xs leading-5 text-slate-400">
            {result.disclaimer}
          </p>
        </div>
      )}

      <p className="mt-6 text-xs leading-5 text-slate-500">
        Calculations are performed by the Spring Boot backend through
        the Dividend Agent API and MCP. No trades or portfolio changes
        are made.
      </p>
    </section>
  );
}