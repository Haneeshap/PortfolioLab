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
    <div className="pl-metric">
      <p className="pl-metric-label">{label}</p>
      <p
        className={`pl-metric-value ${accent ? "positive" : ""}`}
      >
        {value}
      </p>
      <p className="pl-metric-foot">SIMULATED ACCOUNT</p>
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
  } = usePortfolioData(true);

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
    <section className="pl-overview">
      <div className="pl-overview-hero">
        <div><span className="pl-overview-eyebrow">YOUR FINANCIAL WORKSPACE</span>
          <h2>Portfolio at a glance<span style={{color:"var(--pl-accent)"}}>.</span></h2>
          <p>{portfolio.name} · Fictional investment portfolio</p>
        </div>
        <div className="pl-overview-tag"><span className="pl-live-dot" /> {isPortfolioLive ? "Live simulated valuation" : "Reference valuation"}</div>
      </div>

      <div className="pl-metrics">
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

      <div className="pl-snapshot">
        <h3 className="text-lg font-semibold">
          Portfolio Snapshot
        </h3>

        <div className="pl-snapshot-grid">
          <div className="pl-snapshot-stat">
            <p className="text-sm text-slate-400">
              Assets currently held
            </p>
            <p className="mt-2 text-2xl font-semibold">
              {holdings.length}
            </p>
          </div>

          <div className="pl-snapshot-stat">
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

      <p className="pl-overview-disclaimer">
        Unrealized P&L reflects simulated valuations.
        Orders execute at backend reference prices.
      </p>
    </section>
  );
}
