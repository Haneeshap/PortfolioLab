"use client";

import {
  formatMoney,
  usePortfolioData,
} from "@/components/usePortfolioData";

export default function ActivityHistory() {
  const { transactions, loading, error } = usePortfolioData();

  if (loading) {
    return <p className="text-slate-400">Loading activity...</p>;
  }

  if (error) {
    return <p className="text-red-400">{error}</p>;
  }

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">
          Transaction History
        </h2>
        <p className="mt-2 text-sm text-slate-400">
          Completed simulated BUY and SELL orders.
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
        {transactions.length === 0 ? (
          <p className="p-6 text-slate-400">
            No transactions recorded.
          </p>
        ) : (
          <div className="divide-y divide-slate-800">
            {transactions.map((transaction) => (
              <div
                key={transaction.id}
                id={`transaction-${transaction.id}`}
                className="flex flex-wrap items-center justify-between gap-4 px-6 py-5"
              >
                <div>
                  <p className="font-medium">
                    <span
                      className={
                        transaction.type === "BUY"
                          ? "text-blue-400"
                          : "text-emerald-400"
                      }
                    >
                      {transaction.type}
                    </span>{" "}
                    - {transaction.assetSymbol}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    {transaction.quantity} units -{" "}
                    {new Date(
                      transaction.createdAt
                    ).toLocaleString("en-IN")}
                  </p>
                </div>

                <p className="font-semibold">
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
