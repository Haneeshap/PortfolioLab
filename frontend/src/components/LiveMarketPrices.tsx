
"use client";

import { useMarketPrices } from "./MarketPriceProvider";

export default function LiveMarketPrices() {
  const { prices, status } = useMarketPrices();

  return (
    <section className="mt-8 overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
      <div className="border-b border-slate-800 px-6 py-5">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold">
            Live Simulated Market
          </h2>

          <span
            className={`text-xs font-medium ${
              status === "connected"
                ? "text-emerald-400"
                : "text-amber-400"
            }`}
          >
            {status === "connected"
              ? "● Live"
              : status === "connecting"
                ? "● Connecting"
                : "● Reconnecting"}
          </span>
        </div>

        <p className="mt-1 text-sm text-slate-400">
          Fictional market prices streamed through WebSockets
        </p>
      </div>

      {prices.length === 0 ? (
        <p className="p-6 text-slate-400">
          {status === "connected"
            ? "Waiting for simulated prices..."
            : "Connecting to market simulator..."}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-800/50 text-sm text-slate-400">
              <tr>
                <th className="px-6 py-4">Symbol</th>
                <th className="px-6 py-4 text-right">
                  Price
                </th>
                <th className="px-6 py-4 text-right">
                  Updated
                </th>
              </tr>
            </thead>

            <tbody>
              {[...prices]
                .sort((a, b) =>
                  a.symbol.localeCompare(b.symbol)
                )
                .map((asset) => (
                  <tr
                    key={asset.symbol}
                    className="border-t border-slate-800"
                  >
                    <td className="px-6 py-4 font-semibold text-emerald-400">
                      {asset.symbol}
                    </td>

                    <td className="px-6 py-4 text-right tabular-nums">
                      {new Intl.NumberFormat("en-IN", {
                        style: "currency",
                        currency: asset.currency,
                      }).format(asset.price)}
                    </td>

                    <td className="px-6 py-4 text-right text-sm text-slate-400">
                      {new Date(
                        asset.updatedAt
                      ).toLocaleTimeString()}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
