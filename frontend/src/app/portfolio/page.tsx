export const instant = false;
import Link from "next/link";
import PortfolioHoldings from "@/components/PortfolioHoldings";
import { getAssets } from "@/app/assets";

export default async function PortfolioPage() {
  const assets = await getAssets();

  return <div className="space-y-4"><Link href="/portfolio/risk" className="text-emerald-400 underline">Explore hypothetical portfolio outcomes in Risk Lab</Link><PortfolioHoldings assets={assets} /></div>;
}

