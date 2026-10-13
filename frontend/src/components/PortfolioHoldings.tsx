"use client";

import TradeForm from "@/components/TradeForm";
import {
  formatMoney,
  usePortfolioData,
} from "@/components/usePortfolioData";

type Asset = {
  id: number;
  symbol: string;
  name: string;
  price: number;
  currency: string;
};

export default function PortfolioHoldings({
  assets,
}: {
  assets: Asset[];
}) {
  const {
    portfolio,
    holdings,
    loading,
    error,
    refresh,
  } = usePortfolioData();

  if (loading) {
    return <p className="text-slate-400">Loading portfolio...</p>;
  }

  if (error || !portfolio) {
    return <p className="text-red-400">{error ?? "Portfolio unavailable"}</p>;
  }

  return (
    <section className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold">
          Holdings & Trading
        </h2>
        <p className="mt-2 text-sm text-slate-400">
          Available cash:{" "}
          {formatMoney(
            portfolio.cashBalance,
            portfolio.currency
          )}
        </p>
      </div>

      <TradeForm
        assets={assets}
        onTradeCompleted={refresh}
      />

      <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
        <div className="border-b border-slate-800 px-6 py-5">
          <h3 className="text-lg font-semibold">
            Your Holdings
          </h3>
        </div>

        {holdings.length === 0 ? (
          <p className="p-6 text-slate-400">
            You don't own any assets yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-800/50 text-slate-400">
                <tr>
                  <th className="px-6 py-4">Asset</th>
                  <th className="px-6 py-4">Quantity</th>
                  <th className="px-6 py-4">Avg. Buy</th>
                  <th className="px-6 py-4">Historical Cost</th><th className="px-6 py-4">Live Value</th>
                  <th className="px-6 py-4">Unrealized P&L</th>
                </tr>
              </thead>
              <tbody>
                {holdings.map((holding) => (
                  <tr
                    key={holding.assetId}
                    className="border-t border-slate-800"
                  >
                    <td className="px-6 py-4">
                      <p className="font-semibold text-emerald-400">
                        {holding.symbol}
                      </p>
                      <p className="text-xs text-slate-400">
                        {holding.name}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      {holding.quantity}
                    </td>
                    <td className="px-6 py-4">
                      {formatMoney(
                        holding.averageBuyPrice,
                        holding.currency
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {formatMoney(
                        holding.historicalCostInPortfolioCurrency,
                        portfolio.currency
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-medium">
                          {formatMoney(
                            holding.marketValue,
                            holding.currency
                          )}
                        </p>
                        {holding.currency !== portfolio.currency && (
                          <p className="mt-1 text-xs text-slate-400">
                            {formatMoney(
                              holding.marketValueInPortfolioCurrency,
                              portfolio.currency
                            )}{" "}
                            in portfolio currency
                          </p>
                        )}
                      </div>
                    </td>
                    <td
                      className={`px-6 py-4 font-medium ${
                        holding.unrealizedProfitLossInPortfolioCurrency >= 0
                          ? "text-emerald-400"
                          : "text-red-400"
                      }`}
                    >
                      <div>
                        {formatMoney(
                          holding.unrealizedProfitLossInPortfolioCurrency,
                          portfolio.currency
                        )}
                        {holding.currency !== portfolio.currency && (
                          <p className="mt-1 text-xs text-slate-400">
                            Price-only P&L:{" "}
                            {formatMoney(
                              holding.unrealizedProfitLoss,
                              holding.currency
                            )}
                          </p>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
