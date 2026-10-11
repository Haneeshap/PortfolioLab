
"use client";

import { useEffect, useState } from "react";

type MarketPrice = {
  symbol: string;
  price: number;
  currency: string;
  updatedAt: string;
};

export default function LiveMarketPrices() {
  const [prices, setPrices] = useState<MarketPrice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadPrices() {
      try {
        const response = await fetch("/api/market/prices", {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("Market service unavailable");
        }

        const data: MarketPrice[] = await response.json();

        if (active) {
          setPrices(data);
          setError(null);
        }
      } catch {
        if (active) {
          setError("Unable to refresh simulated prices");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadPrices();

    const interval = setInterval(() => {
      void loadPrices();
    }, 5000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <section className="mt-8 overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
      <div className="border-b border-slate-800 px-6 py-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">
              Live Simulated Market
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              Fictional prices refresh every 5 seconds
            </p>
          </div>

          <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs text-emerald-400">
            SIMULATION
          </span>
        </div>
      </div>

      {loading ? (
        <p className="px-6 py-6 text-slate-400">
          Loading simulated prices...
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-800/50 text-sm text-slate-400">
              <tr>
                <th className="px-6 py-4">Symbol</th>
                <th className="px-6 py-4 text-right">Price</th>
                <th className="px-6 py-4">Last Updated</th>
              </tr>
            </thead>

            <tbody>
              {prices.map((asset) => (
                <tr
                  key={asset.symbol}
                  className="border-t border-slate-800"
                >
                  <td className="px-6 py-4 font-semibold text-emerald-400">
                    {asset.symbol}
                  </td>

                  <td className="px-6 py-4 text-right">
                    {new Intl.NumberFormat("en-IN", {
                      style: "currency",
                      currency: asset.currency,
                    }).format(asset.price)}
                  </td>

                  <td className="px-6 py-4 text-sm text-slate-400">
                    {new Date(asset.updatedAt).toLocaleTimeString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {error && (
        <p role="alert" className="px-6 py-4 text-sm text-amber-400">
          {error}
        </p>
      )}
    </section>
  );
}
