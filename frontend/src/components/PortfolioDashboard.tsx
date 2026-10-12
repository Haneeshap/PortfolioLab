
"use client";

import { useMarketPrices } from "@/components/MarketPriceProvider";
import TradeForm from "@/components/TradeForm";
import { useEffect, useState } from "react";

type Portfolio = {
  id: number;
  name: string;
  cashBalance: number;
  currency: string;
};

type Holding = {
  assetId: number;
  symbol: string;
  name: string;
  quantity: number;
  averageBuyPrice: number;
  currentPrice: number;
  marketValue: number;
  unrealizedProfitLoss: number;
  currency: string;
};

type Transaction = {
  id: number;
  assetSymbol: string;
  type: string;
  quantity: number;
  pricePerUnit: number;
  totalAmount: number;
  currency: string;
  createdAt: string;
};

type PortfolioData = {
  portfolio: Portfolio;
  holdings: Holding[];
  transactions: Transaction[];
};

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

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
  const [data, setData] = useState<PortfolioData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { prices: livePrices, status: marketStatus } = useMarketPrices();

const livePriceBySymbol = new Map(
  livePrices.map((asset) => [asset.symbol, asset])
);
async function refreshPortfolio(): Promise<void> {
  const response = await fetch("/api/portfolio", {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Unable to refresh portfolio");
  }

  const result: PortfolioData = await response.json();

  setData(result);
  setError(null);
}
  useEffect(() => {
    const controller = new AbortController();

    async function loadPortfolio() {
      try {
        const response = await fetch("/api/portfolio", {
          cache: "no-store",
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error("Unable to load portfolio data");
        }

        const result: PortfolioData = await response.json();
        setData(result);
      } catch (err) {
        if (controller.signal.aborted) return;

        setError(
          err instanceof Error ? err.message : "Unknown error"
        );
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void loadPortfolio();

    return () => controller.abort();
  }, []);

  if (loading) {
    return <p className="text-gray-500">Loading portfolio...</p>;
  }

  if (error || !data) {
    return (
      <p className="text-red-500">
        {error ?? "Portfolio data unavailable"}
      </p>
    );
  }

  const { portfolio, holdings, transactions } = data;

// Calculate each holding using its latest simulated price.
const valuedHoldings = holdings.map((holding) => {
  const liveQuote = livePriceBySymbol.get(holding.symbol);

  const priceIsLive =
    marketStatus === "connected" &&
    liveQuote?.currency === holding.currency;

  const currentPrice = priceIsLive
    ? liveQuote.price
    : holding.currentPrice;

  const marketValue = holding.quantity * currentPrice;

  const investedAmount =
    holding.quantity * holding.averageBuyPrice;

  return {
    ...holding,
    currentPrice,
    marketValue,
    unrealizedProfitLoss: marketValue - investedAmount,
    priceIsLive,
  };
});

const holdingsValue = valuedHoldings.reduce(
  (sum, holding) => sum + holding.marketValue,
  0
);

const investedAmount = valuedHoldings.reduce(
  (sum, holding) =>
    sum + holding.quantity * holding.averageBuyPrice,
  0
);

const unrealizedProfitLoss = holdingsValue - investedAmount;

const totalValue = portfolio.cashBalance + holdingsValue;

const isPortfolioLive =
  valuedHoldings.length > 0 &&
  valuedHoldings.every((holding) => holding.priceIsLive);

  return (
    <section className="space-y-6">
        <TradeForm
  assets={assets}
  onTradeCompleted={refreshPortfolio}
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
    label="Unrealized P&L"
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

        {holdings.length === 0 ? (
          <p className="text-gray-500">
            You don't own any assets yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-800">
                  <th className="py-3">Asset</th>
                  <th>Quantity</th>
                  <th>Average Price</th>
                  <th>Market Value</th>
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
                        holding.marketValue,
                        holding.currency
                      )}
                    </td>
                    <td
                      className={
                        holding.unrealizedProfitLoss >= 0
                          ? "text-green-600"
                          : "text-red-500"
                      }
                    >
                      {formatMoney(
                        holding.unrealizedProfitLoss,
                        holding.currency
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
