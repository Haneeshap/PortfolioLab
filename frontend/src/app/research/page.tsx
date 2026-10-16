import {Suspense} from "react";
import ResearchTerminal from "@/components/ResearchTerminal";
import {getAssets} from "@/app/assets";
type Props={searchParams:Promise<{assetId?:string}>};
async function ResearchContent({searchParams}:Props){const query=await searchParams;const id=Number(query.assetId);return <ResearchTerminal key={id||0} assets={await getAssets()} initialAssetId={id}/>;}
export default function ResearchPage(props:Props){return <Suspense fallback={<p role="status">Loading fictional asset catalog...</p>}><ResearchContent {...props}/></Suspense>;}
