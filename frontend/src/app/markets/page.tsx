export const instant = false;
import AssetCatalog from "@/components/AssetCatalog";
import LiveMarketPrices from "@/components/LiveMarketPrices";
import { getAssets } from "@/app/assets";

export default async function MarketsPage() {
  const assets = await getAssets();

  return (
    <div className="space-y-6">
      <AssetCatalog assets={assets} />
      <LiveMarketPrices />
    </div>
  );
}

