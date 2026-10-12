
"use client";

import PortfolioPerformanceChart from "@/components/PortfolioPerformanceChart";
import {
  formatMoney,
  usePortfolioData,
} from "@/components/usePortfolioData";

function Metric({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
      <p className="text-sm text-slate-400">{label}</p>
      <p
        className={`mt-3 text-2xl font-semibold ${
          accent ? "text-emerald-400" : "text-white"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

export default function OverviewDashboard() {
  const {
    portfolio,
    holdings,
    loading,
    error,
    totalValue,
    investedAmount,
    unrealizedProfitLoss,
    isPortfolioLive,
  } = usePortfolioData();

  if (loading) {
    return <p className="text-slate-400">Loading overview...</p>;
  }

  if (error || !portfolio) {
    return (
      <p className="text-red-400">
        {error ?? "Portfolio unavailable"}
      </p>
    );
  }

  return (
    <section className="space-y-7">
      <div>
        <h2 className="text-2xl font-semibold">
          Your Investment Overview
        </h2>
        <p className="mt-2 text-sm text-slate-400">
          {portfolio.name} - Fictional investment portfolio
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          label="Total Portfolio Value"
          value={formatMoney(totalValue, portfolio.currency)}
        />
        <Metric
          label="Available Cash"
          value={formatMoney(
            portfolio.cashBalance,
            portfolio.currency
          )}
        />
        <Metric
          label="Invested Amount"
          value={formatMoney(
            investedAmount,
            portfolio.currency
          )}
        />
        <Metric
          label="Unrealized P&L"
          value={formatMoney(
            unrealizedProfitLoss,
            portfolio.currency
          )}
          accent={unrealizedProfitLoss >= 0}
        />
      </div>

      <PortfolioPerformanceChart
        value={totalValue}
        ready={isPortfolioLive || holdings.length === 0}
      />

      <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
        <h3 className="text-lg font-semibold">
          Portfolio Snapshot
        </h3>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-sm text-slate-400">
              Assets currently held
            </p>
            <p className="mt-2 text-2xl font-semibold">
              {holdings.length}
            </p>
          </div>

          <div>
            <p className="text-sm text-slate-400">
              Market valuation
            </p>
            <p className="mt-2 text-sm font-medium">
              {isPortfolioLive
                ? "Live simulated prices"
                : "Reference prices / awaiting live data"}
            </p>
          </div>
        </div>
      </div>

      <p className="text-xs text-slate-500">
        Unrealized P&L reflects simulated valuations.
        Orders execute at backend reference prices.
      </p>
    </section>
  );
}
