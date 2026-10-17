
"use client";

import {
  usePortfolioData,
  formatMoney,
} from "@/components/usePortfolioData";
import TradeForm from "@/components/TradeForm";


type Asset = {
  id: number;
  symbol: string;
  name: string;
  price: number;
  currency: string;
};

export default function PortfolioDashboard({
  assets,
}: {
  assets: Asset[];
}) {
  const {
    portfolio,
    holdings: valuedHoldings,
    transactions,
    loading,
    error,
    refresh,
    investedAmount,
    unrealizedProfitLoss,
    totalValue,
    isPortfolioLive,
  } = usePortfolioData();

  if (loading) {
    return <p className="text-gray-500">Loading portfolio...</p>;
  }

  if (error || !portfolio) {
    return (
      <p className="text-red-500">
        {error ?? "Portfolio data unavailable"}
      </p>
    );
  }

  return (    <section className="space-y-6">
        <TradeForm
          assets={assets}
          portfolio={portfolio}
          holdings={valuedHoldings}
          onTradeCompleted={refresh}
        />
      <div>
        <h2 className="text-2xl font-semibold">My Portfolio</h2>
        <p className="text-sm text-gray-500">
          {portfolio.name} · {portfolio.currency} · Simulated
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
  <SummaryCard
    label="Total Portfolio Value"
    value={formatMoney(totalValue, portfolio.currency)}
  />

  <SummaryCard
    label="Available Cash"
    value={formatMoney(portfolio.cashBalance, portfolio.currency)}
  />

  <SummaryCard
    label="Invested Amount"
    value={formatMoney(investedAmount, portfolio.currency)}
  />

  <SummaryCard
    label="Unrealized P&L (Including FX)"
    value={formatMoney(unrealizedProfitLoss, portfolio.currency)}
  />
</div>

<p className="text-xs text-slate-400">
  {isPortfolioLive
    ? "Portfolio valuation uses live simulated market prices."
    : "Portfolio valuation includes reference prices. Live quotes are unavailable or incomplete."}
</p>

      <div className="rounded-xl border border-gray-200 p-5 dark:border-gray-800">
        <h3 className="mb-4 text-lg font-semibold">
          Your Holdings
        </h3>

        {valuedHoldings.length === 0 ? (
          <p className="text-gray-500">
            You don&apos;t own any assets yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-800">
                  <th className="py-3">Asset</th>
                  <th>Quantity</th>
                  <th>Average Price</th>
                  <th>Historical Cost</th><th>Market Value</th>
                  <th>Unrealized P/L</th>
                </tr>
              </thead>
              <tbody>
                {valuedHoldings.map((holding) => (

                  <tr
                    key={holding.assetId}
                    className="border-b border-gray-100 dark:border-gray-900"
                  >
                    <td className="py-3">
                      <div className="font-medium">
                        {holding.symbol}
                      </div>
                      <div className="text-xs text-gray-500">
                        {holding.name}
                      </div>
                    </td>
                    <td>{holding.quantity}</td>
                    <td>
                      {formatMoney(
                        holding.averageBuyPrice,
                        holding.currency
                      )}
                    </td>
                    <td>
                      {formatMoney(
                        holding.historicalCostInPortfolioCurrency,
                        portfolio.currency
                      )}
                    </td>
                    <td>
                      {formatMoney(
                        holding.marketValueInPortfolioCurrency,
                        portfolio.currency
                      )}
                    </td>
                    <td
                      className={
                        holding.unrealizedProfitLossInPortfolioCurrency >= 0
                          ? "text-green-600"
                          : "text-red-500"
                      }
                    >
                      {formatMoney(
                        holding.unrealizedProfitLossInPortfolioCurrency,
                        portfolio.currency
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-gray-200 p-5 dark:border-gray-800">
        <h3 className="mb-4 text-lg font-semibold">
          Transaction History
        </h3>

        {transactions.length === 0 ? (
          <p className="text-gray-500">
            No transactions recorded.
          </p>
        ) : (
          <div className="space-y-3">
            {transactions.map((transaction) => (
              <div
                key={transaction.id}
                className="flex items-center justify-between border-b border-gray-100 py-2 dark:border-gray-900"
              >
                <div>
                  <p className="font-medium">
                    <span
                      className={
                        transaction.type === "BUY"
                          ? "text-blue-600"
                          : "text-green-600"
                      }
                    >
                      {transaction.type}
                    </span>{" "}
                    · {transaction.assetSymbol}
                  </p>
                  <p className="text-xs text-gray-500">
                    {transaction.quantity} units ·{" "}
                    {new Date(
                      transaction.createdAt
                    ).toLocaleString("en-IN")}
                  </p>
                </div>
                <p className="font-medium">
                  {formatMoney(
                    transaction.totalAmount,
                    transaction.currency
                  )}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function SummaryCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 p-5 dark:border-gray-800">
      <p className="mb-2 text-sm text-gray-500">{label}</p>
      <p className="text-xl font-semibold">{value}</p>
    </div>
  );
}
