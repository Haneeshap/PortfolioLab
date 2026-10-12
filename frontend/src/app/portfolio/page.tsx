export const instant = false;
import PortfolioHoldings from "@/components/PortfolioHoldings";
import { getAssets } from "@/app/assets";

export default async function PortfolioPage() {
  const assets = await getAssets();

  return <PortfolioHoldings assets={assets} />;
}

