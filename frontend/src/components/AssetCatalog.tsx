"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useMarketPrices } from "@/components/MarketPriceProvider";
import type { Asset } from "@/app/assets";

function formatPrice(value: number, currency: string) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
  }).format(value);
}

export default function AssetCatalog({
  assets,
}: {
  assets: Asset[];
}) {
  const [search, setSearch] = useState("");
  const [selectedAssetId, setSelectedAssetId] = useState<number | null>(null);
  const { prices, status } = useMarketPrices();

  const filteredAssets = useMemo(() => {
    const query = search.trim().toLowerCase();

    return assets.filter(
      (asset) =>
        asset.symbol.toLowerCase().includes(query) ||
        asset.name.toLowerCase().includes(query)
    );
  }, [assets, search]);

  const livePrices = useMemo(
    () => new Map(prices.map((price) => [price.symbol, price])),
    [prices]
  );

  const selectedAsset =
    assets.find((asset) => asset.id === selectedAssetId) ?? null;

  const selectedQuote = selectedAsset
    ? livePrices.get(selectedAsset.symbol)
    : undefined;

  return (
    <section className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
      <div className="border-b border-slate-800 px-6 py-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Market Explorer</h2>
            <p className="mt-1 text-sm text-slate-400">
              Discover fictional assets and follow simulated market prices.
            </p>
          </div>

          <span
            className={`text-xs font-medium ${
              status === "connected"
                ? "text-emerald-400"
                : "text-amber-400"
            }`}
          >
            {status === "connected"
              ? "Live simulation connected"
              : status === "connecting"
                ? "Connecting to market"
                : "Market reconnecting"}
          </span>
        </div>

        <label
          htmlFor="asset-search"
          className="mt-5 block text-sm text-slate-300"
        >
          Search assets
        </label>

        <input
          id="asset-search"
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by company or symbol"
          className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-sm outline-none focus:border-emerald-500 sm:max-w-md"
        />
      </div>

      {selectedAsset && (
        <div className="border-b border-slate-800 bg-slate-950/50 p-6">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">
                Selected fictional asset
              </p>
              <h3 className="mt-2 text-2xl font-bold text-emerald-400">
                {selectedAsset.symbol}
              </h3>
              <p className="mt-1 text-slate-300">{selectedAsset.name}</p>
            </div>

            <div className="sm:text-right">
              <p className="text-xs text-slate-400">
                Simulated market price
              </p>
              <p className="mt-2 text-2xl font-semibold">
                {status === "connected" &&
                selectedQuote &&
                selectedQuote.currency === selectedAsset.currency &&
                Number.isFinite(selectedQuote.price) &&
                selectedQuote.price > 0 &&
                Number.isFinite(Date.parse(selectedQuote.updatedAt)) &&
                Date.now() - Date.parse(selectedQuote.updatedAt) >= -10000 &&
                Date.now() - Date.parse(selectedQuote.updatedAt) <= 60000
                  ? formatPrice(selectedQuote.price, selectedQuote.currency)
                  : "Unavailable"}
              </p>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-8 border-t border-slate-800 pt-5">
            <div>
              <p className="text-xs text-slate-400">Reference price</p>
              <p className="mt-1 font-semibold">
                {formatPrice(selectedAsset.price, selectedAsset.currency)}
              </p>
            </div>

            <div>
              <p className="text-xs text-slate-400">Currency</p>
              <p className="mt-1 font-semibold">{selectedAsset.currency}</p>
            </div>
          </div>

          <Link
            href={`/portfolio?assetId=${selectedAsset.id}`}
            className="mt-5 inline-flex rounded-lg bg-emerald-500 px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-emerald-400"
          >
            Trade selected asset
          </Link>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-800/50 text-slate-400">
            <tr>
              <th className="px-6 py-4">Asset</th>
              <th className="px-6 py-4 text-right">Reference</th>
              <th className="px-6 py-4 text-right">Simulated live price</th>
              <th className="px-6 py-4 text-right">Action</th>
            </tr>
          </thead>

          <tbody>
            {filteredAssets.map((asset) => {
              const quote = livePrices.get(asset.symbol);

              const validQuote =
                status === "connected" &&
                quote !== undefined &&
                quote.currency === asset.currency &&
                Number.isFinite(quote.price) &&
                quote.price > 0 &&
                Number.isFinite(Date.parse(quote.updatedAt)) &&
                Date.now() - Date.parse(quote.updatedAt) <= 60000 &&
                Date.now() - Date.parse(quote.updatedAt) >= -10000;

              return (
                <tr
                  key={asset.id}
                  className="border-t border-slate-800 hover:bg-slate-800/40"
                >
                  <td className="px-6 py-4">
                    <button
                      type="button"
                      onClick={() => setSelectedAssetId(asset.id)}
                      aria-pressed={selectedAssetId === asset.id}
                      className="cursor-pointer font-semibold text-emerald-400 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
                    >
                      {asset.symbol}
                    </button>
                    <p className="mt-1 text-xs text-slate-400">
                      {asset.name} · {asset.currency}
                    </p>
                  </td>

                  <td className="px-6 py-4 text-right tabular-nums">
                    {formatPrice(asset.price, asset.currency)}
                  </td>

                  <td className="px-6 py-4 text-right tabular-nums">
                    {validQuote && quote ? (
                      <span className="font-medium text-slate-100">
                        {formatPrice(quote.price, quote.currency)}
                      </span>
                    ) : (
                      <span className="text-amber-400">
                        Unavailable
                      </span>
                    )}
                  </td>

                  <td className="px-6 py-4 text-right">
                    <Link
                      href={`/portfolio?assetId=${asset.id}`}
                      className="inline-flex whitespace-nowrap rounded-lg border border-emerald-500/40 px-3 py-2 font-medium text-emerald-400 transition hover:bg-emerald-500/10"
                    >
                      Trade asset
                    </Link>
                    <Link href={`/research?assetId=${asset.id}`} className="ml-3 text-emerald-400 underline">Research</Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {filteredAssets.length === 0 && (
          <p className="p-6 text-center text-sm text-slate-400">
            No assets match your search.
          </p>
        )}
      </div>

      <p className="border-t border-slate-800 px-6 py-3 text-xs text-slate-500">
        Reference prices come from the asset catalog. Live prices are
        simulated WebSocket quotes and may be temporarily unavailable.
      </p>
    </section>
  );
}