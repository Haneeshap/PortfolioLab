type Asset = {
  id: number;
  symbol: string;
  name: string;
  price: number;
  currency: string;
};

export default function AssetCatalog({
  assets,
}: {
  assets: Asset[];
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
      <div className="border-b border-slate-800 px-6 py-5">
        <h2 className="text-lg font-semibold">Asset Catalog</h2>
        <p className="mt-1 text-sm text-slate-400">
          Fictional assets stored in PostgreSQL
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-slate-800/50 text-sm text-slate-400">
            <tr>
              <th className="px-6 py-4">Symbol</th>
              <th className="px-6 py-4">Company</th>
              <th className="px-6 py-4 text-right">
                Reference Price
              </th>
              <th className="px-6 py-4">Currency</th>
            </tr>
          </thead>

          <tbody>
            {assets.map((asset) => (
              <tr
                key={asset.id}
                className="border-t border-slate-800 hover:bg-slate-800/40"
              >
                <td className="px-6 py-4 font-semibold text-emerald-400">
                  {asset.symbol}
                </td>
                <td className="px-6 py-4">{asset.name}</td>
                <td className="px-6 py-4 text-right">
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
  );
}
