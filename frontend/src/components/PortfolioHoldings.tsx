"use client";

import { useRef, useState } from "react";
import TradeForm from "@/components/TradeForm";
import { formatMoney, usePortfolioData } from "@/components/usePortfolioData";

type Asset = {
  id: number;
  symbol: string;
  name: string;
  price: number;
  currency: string;
};

export default function PortfolioHoldings({ assets }: { assets: Asset[] }) {
  const tradeDetailsRef = useRef<HTMLDetailsElement>(null);
  const [holdingTradeRequest, setHoldingTradeRequest] = useState<{
    assetId: number;
    sequence: number;
  } | null>(null);

  const { portfolio, holdings, loading, error, refresh, isPortfolioLive } =
    usePortfolioData();

  function tradeHolding(assetId: number) {
    setHoldingTradeRequest((previous) => ({
      assetId,
      sequence: (previous?.sequence ?? 0) + 1,
    }));
    if (tradeDetailsRef.current) {
      tradeDetailsRef.current.open = true;
      requestAnimationFrame(() => {
        tradeDetailsRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      });
    }
  }

  if (loading) return <p className="text-slate-400">Loading portfolio...</p>;
  if (error || !portfolio) {
    return <p className="text-red-400">{error ?? "Portfolio unavailable"}</p>;
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold">Your Holdings</h2>
          <p className="mt-1 text-sm text-slate-400">
            {holdings.length} positions · {isPortfolioLive ? "Live simulated prices" : "Reference / mixed prices"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            if (tradeDetailsRef.current) {
              tradeDetailsRef.current.open = true;
              tradeDetailsRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
            }
          }}
          className="rounded-lg border border-emerald-500/50 px-4 py-2 text-sm font-semibold text-emerald-300 hover:bg-emerald-500/10"
        >
          Place simulated order
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
        {holdings.length === 0 ? (
          <p className="p-6 text-slate-400">You don't own any assets yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-800/50 text-slate-400">
                <tr>
                  <th className="px-4 py-3">Asset</th>
                  <th className="px-4 py-3">Quantity</th>
                  <th className="px-4 py-3">Avg. Buy</th>
                  <th className="px-4 py-3">Historical Cost</th>
                  <th className="px-4 py-3">Market Value</th>
                  <th className="px-4 py-3">Unrealized P&amp;L</th>
                  <th className="px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {holdings.map((holding) => (
                  <tr key={holding.assetId} className="border-t border-slate-800">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-emerald-400">{holding.symbol}</p>
                      <p className="text-xs text-slate-400">{holding.name}</p>
                    </td>
                    <td className="px-4 py-3">{holding.quantity}</td>
                    <td className="px-4 py-3">{formatMoney(holding.averageBuyPrice, holding.currency)}</td>
                    <td className="px-4 py-3">{formatMoney(holding.historicalCostInPortfolioCurrency, portfolio.currency)}</td>
                    <td className="px-4 py-3">
                      <p>{formatMoney(holding.marketValue, holding.currency)}</p>
                      {holding.currency !== portfolio.currency && (
                        <p className="text-xs text-slate-400">
                          {formatMoney(holding.marketValueInPortfolioCurrency, portfolio.currency)} in portfolio currency
                        </p>
                      )}
                    </td>
                    <td className={`px-4 py-3 font-medium ${holding.unrealizedProfitLossInPortfolioCurrency >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                      <p>{formatMoney(holding.unrealizedProfitLossInPortfolioCurrency, portfolio.currency)}</p>
                      {holding.currency !== portfolio.currency && (
                        <p className="text-xs text-slate-400">
                          Price-only: {formatMoney(holding.unrealizedProfitLoss, holding.currency)}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => tradeHolding(holding.assetId)}
                        className="rounded-lg border border-emerald-500/50 px-3 py-2 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/10"
                      >
                        Trade
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <details ref={tradeDetailsRef} className="scroll-mt-6 rounded-xl border border-slate-800 bg-slate-900">
        <summary className="cursor-pointer px-5 py-4 text-sm font-semibold">
          Simulated Trading — open trade ticket
        </summary>
        <div className="border-t border-slate-800 p-3">
          <TradeForm
            assets={assets}
            portfolio={portfolio}
            holdings={holdings}
            onTradeCompleted={refresh}
            holdingTradeRequest={holdingTradeRequest}
          />
        </div>
      </details>
    </section>
  );
}
