"use client";

import { useState } from "react";

type BonusSimulation = {
  existingShares: number;
  bonusShares: number;
  requiredShares: number;
  additionalShares: number;
  totalShares: number;
  calculation: string;
  disclaimer: string;
};

export default function BonusAgent() {
  const [existingShares, setExistingShares] = useState("100");
  const [bonusShares, setBonusShares] = useState("1");
  const [requiredShares, setRequiredShares] = useState("2");

  const [result, setResult] = useState<BonusSimulation | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function simulate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setResult(null);

    const existing = Number(existingShares);
    const bonus = Number(bonusShares);
    const required = Number(requiredShares);

    if (
      existingShares.trim() === "" ||
      bonusShares.trim() === "" ||
      requiredShares.trim() === "" ||
      !Number.isSafeInteger(existing) ||
      !Number.isSafeInteger(bonus) ||
      !Number.isSafeInteger(required) ||
      existing < 0 ||
      bonus <= 0 ||
      required <= 0
    ) {
      setError("Use whole numbers. Existing shares cannot be negative, and the bonus ratio must be positive.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/ai/agents/bonus/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          existingShares: existing,
          bonusShares: bonus,
          requiredShares: required
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Bonus simulation failed.");
      }

      setResult(data.simulation as BonusSimulation);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to simulate bonus shares."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-sm">
      <div className="mb-5">
        <h2 className="text-xl font-semibold text-white">
          Bonus Agent
        </h2>
        <p className="mt-1 text-sm text-slate-400">
          Simulate additional shares from a hypothetical bonus issue.
          No portfolio holdings are changed.
        </p>
      </div>

      <form onSubmit={simulate} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block text-sm font-medium text-slate-300">
            Existing shares
            <input
              type="number"
              min="0"
              step="1"
              required
              value={existingShares}
              onChange={(e) => setExistingShares(e.target.value)}
              className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white"
            />
          </label>

          <label className="block text-sm font-medium text-slate-300">
            Bonus shares
            <input
              type="number"
              min="1"
              step="1"
              required
              value={bonusShares}
              onChange={(e) => setBonusShares(e.target.value)}
              className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white"
            />
          </label>

          <label className="block text-sm font-medium text-slate-300">
            Per existing shares
            <input
              type="number"
              min="1"
              step="1"
              required
              value={requiredShares}
              onChange={(e) => setRequiredShares(e.target.value)}
              className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white"
            />
          </label>
        </div>

        <p className="text-xs text-slate-400">
          Example: 1 bonus share per 2 existing shares is a 1:2 ratio.
        </p>

        <button
          type="submit"
          disabled={loading}
          className="cursor-pointer rounded-lg bg-emerald-400 px-5 py-2.5 text-sm font-semibold text-slate-950 shadow-sm transition-all hover:bg-emerald-300 hover:shadow-md active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Simulating..." : "Simulate Bonus"}
        </button>
      </form>

      {error && (
        <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {result && (
        <div className="mt-6 space-y-4 border-t border-slate-800 pt-5">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-slate-800 p-4">
              <p className="text-xs text-slate-400">Existing shares</p>
              <p className="mt-1 text-2xl font-semibold text-white">
                {result.existingShares.toLocaleString()}
              </p>
            </div>

            <div className="rounded-xl bg-emerald-500/10 p-4">
              <p className="text-xs text-emerald-400">Additional shares</p>
              <p className="mt-1 text-2xl font-semibold text-emerald-300">
                +{result.additionalShares.toLocaleString()}
              </p>
            </div>

            <div className="rounded-xl bg-slate-800 p-4">
              <p className="text-xs text-slate-400">Total shares</p>
              <p className="mt-1 text-2xl font-semibold text-white">
                {result.totalShares.toLocaleString()}
              </p>
            </div>
          </div>

          <p className="text-sm text-slate-300">{result.calculation}</p>
          <p className="text-xs text-slate-400">{result.disclaimer}</p>
        </div>
      )}
    </section>
  );
}