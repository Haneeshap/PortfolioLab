export const instant = false;


import LiveMarketPrices from "@/components/LiveMarketPrices";

type Asset = {
  id: number;
  symbol: string;
  name: string;
  price: number;
  currency: string;
};

async function getAssets(): Promise<Asset[]> {
  const response = await fetch("http://127.0.0.1:8080/api/assets", {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Failed to retrieve assets from Spring Boot");
  }

  return response.json();
}

export default async function Home() {
  const assets = await getAssets();

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-12 text-white">
      <div className="mx-auto max-w-6xl">

        {/* Dashboard Header */}
        <header className="mb-10">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500 text-xl font-bold text-slate-950">
              P
            </div>

            <div>
              <p className="text-sm font-semibold tracking-widest text-emerald-400">
                PORTFOLIOLAB
              </p>
              <p className="text-xs text-slate-500">
                Investment Simulation Platform
              </p>
            </div>
          </div>

          <h1 className="text-4xl font-bold tracking-tight">
            Market Overview
          </h1>

          <p className="mt-3 text-slate-400">
            Explore fictional assets and simulated market movements.
          </p>
        </header>

        {/* Dashboard Summary */}
        <section className="mb-8 grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
            <p className="text-sm text-slate-400">
              Available Assets
            </p>

            <p className="mt-3 text-3xl font-bold">
              {assets.length}
            </p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
            <p className="text-sm text-slate-400">
              Market Environment
            </p>

            <p className="mt-3 text-xl font-semibold text-emerald-400">
              Simulation
            </p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
            <p className="text-sm text-slate-400">
              Market Data Source
            </p>

            <p className="mt-3 text-xl font-semibold">
              Go Simulator
            </p>
          </div>
        </section>

        {/* Asset Catalog */}
        <section className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
          <div className="border-b border-slate-800 px-6 py-5">
            <h2 className="text-lg font-semibold">
              Asset Catalog
            </h2>

            <p className="mt-1 text-sm text-slate-400">
              Fictional assets stored in PostgreSQL
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-800/50 text-sm text-slate-400">
                <tr>
                  <th className="px-6 py-4">
                    Symbol
                  </th>

                  <th className="px-6 py-4">
                    Company
                  </th>

                  <th className="px-6 py-4 text-right">
                    Reference Price
                  </th>

                  <th className="px-6 py-4">
                    Currency
                  </th>
                </tr>
              </thead>

              <tbody>
                {assets.map((asset) => (
                  <tr
                    key={asset.id}
                    className="border-t border-slate-800 transition hover:bg-slate-800/40"
                  >
                    <td className="px-6 py-4 font-semibold text-emerald-400">
                      {asset.symbol}
                    </td>

                    <td className="px-6 py-4">
                      {asset.name}
                    </td>

                    <td className="px-6 py-4 text-right font-medium">
                      {new Intl.NumberFormat("en-IN", {
                        style: "currency",
                        currency: asset.currency,
                      }).format(asset.price)}
                    </td>

                    <td className="px-6 py-4 text-slate-400">
                      {asset.currency}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Live Go Market Simulator */}
        <LiveMarketPrices />

        {/* Footer */}
        <footer className="mt-10 border-t border-slate-800 pt-6">
          <p className="text-sm text-slate-500">
            PortfolioLab is an educational investment simulation.
            All assets, prices, and market movements are fictional.
            No real trading is supported.
          </p>
        </footer>

      </div>
    </main>
  );
}
