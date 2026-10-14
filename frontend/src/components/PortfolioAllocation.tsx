"use client";

import { useState } from "react";
import {
  formatMoney,
  type Holding,
  type Portfolio,
} from "@/components/usePortfolioData";

type Props = {
  portfolio: Portfolio;
  holdings: Holding[];
  totalValue: number;
  isPortfolioLive: boolean;
};

const colors = [
  "#10b981",
  "#38bdf8",
  "#a78bfa",
  "#f59e0b",
  "#f472b6",
  "#22d3ee",
  "#fb7185",
];

export default function PortfolioAllocation({
  portfolio,
  holdings,
  totalValue,
  isPortfolioLive,
}: Props) {
  const [selectedKey, setSelectedKey] = useState<string>("cash");

  const positions = holdings
    .filter(
      (holding) =>
        Number.isFinite(holding.marketValueInPortfolioCurrency) &&
        holding.marketValueInPortfolioCurrency > 0
    )
    .map((holding, index) => ({
      key: String(holding.assetId),
      label: holding.symbol,
      name: holding.name,
      value: holding.marketValueInPortfolioCurrency,
      color: colors[index % colors.length],
    }));

  const items = [
    ...positions,
    {
      key: "cash",
      label: "Cash",
      name: "Available simulated cash",
      value: Math.max(0, portfolio.cashBalance),
      color: "#64748b",
    },
  ];

  const allocationTotal = items.reduce(
    (sum, item) => sum + item.value,
    0
  );

  const selected =
    items.find((item) => item.key === selectedKey) ?? items[0];

  if (!Number.isFinite(allocationTotal) || allocationTotal <= 0) {
    return (
      <section className="rounded-xl border border-slate-800 bg-slate-900 p-6">
        <h3 className="text-lg font-semibold">Portfolio Allocation</h3>
        <p className="mt-3 text-sm text-slate-400">
          Allocation will appear when your portfolio has a positive value.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold">
            Portfolio Allocation
          </h3>
          <p className="mt-1 text-sm text-slate-400">
            Select a segment to explore your portfolio composition.
          </p>
        </div>

        <span className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-400">
          {isPortfolioLive ? "Live simulated prices" : "Mixed/reference prices"}
        </span>
      </div>

      <p className="mt-5 text-xs text-slate-400">
        Total portfolio value
      </p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">
        {formatMoney(totalValue, portfolio.currency)}
      </p>

      <div
        className="mt-5 flex h-5 overflow-hidden rounded-full bg-slate-800"
        aria-label="Portfolio allocation"
      >
        {items
          .filter((item) => item.value > 0)
          .map((item) => (
            <button
              key={item.key}
              type="button"
              title={`${item.label}: ${(
                (item.value / allocationTotal) *
                100
              ).toFixed(1)}%`}
              aria-label={`Select ${item.label} allocation`}
              aria-pressed={selected.key === item.key}
              onClick={() => setSelectedKey(item.key)}
              className={`h-full cursor-pointer transition-opacity hover:opacity-75 focus-visible:outline-2 focus-visible:outline-white ${
                selected.key === item.key ? "opacity-100" : "opacity-80"
              }`}
              style={{
                width: `${(item.value / allocationTotal) * 100}%`,
                backgroundColor: item.color,
              }}
            />
          ))}
      </div>

      <div className="mt-5 grid gap-2 sm:grid-cols-2">
        {items.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setSelectedKey(item.key)}
            aria-pressed={selected.key === item.key}
            className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-3 text-left transition ${
              selected.key === item.key
                ? "border-emerald-500 bg-slate-800"
                : "border-slate-800 hover:border-slate-600"
            }`}
          >
            <span
              className="h-3 w-3 shrink-0 rounded-sm"
              style={{ backgroundColor: item.color }}
            />
            <span className="min-w-0 flex-1 truncate text-sm">
              {item.label}
            </span>
            <span className="text-sm font-semibold tabular-nums">
              {((item.value / allocationTotal) * 100).toFixed(1)}%
            </span>
          </button>
        ))}
      </div>

      <div className="mt-5 rounded-lg border border-slate-700 bg-slate-950/50 p-4">
        <p className="text-xs uppercase tracking-wide text-slate-400">
          Selected allocation
        </p>
        <h4 className="mt-2 font-semibold">{selected.name}</h4>

        <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs text-slate-400">Current value</p>
            <p className="mt-1 text-lg font-semibold tabular-nums">
              {formatMoney(selected.value, portfolio.currency)}
            </p>
          </div>
          <div className="sm:text-right">
            <p className="text-xs text-slate-400">Portfolio share</p>
            <p className="mt-1 text-lg font-semibold tabular-nums">
              {((selected.value / allocationTotal) * 100).toFixed(1)}%
            </p>
          </div>
        </div>
      </div>

      <p className="mt-4 text-xs text-slate-500">
        Allocation includes available cash and uses current simulated
        valuations in {portfolio.currency}. Values may change with
        market prices.
      </p>
    </section>
  );
}