import { NextResponse } from "next/server";
const backend=process.env.BACKEND_URL??"http://localhost:8080";
type Context={params:Promise<{id:string;symbol:string}>};
export async function DELETE(_request:Request,context:Context) {
 const {id,symbol}=await context.params;
 if(!/^\d+$/.test(id)||! /^[A-Za-z0-9._-]{1,20}$/.test(symbol))return NextResponse.json({error:"Invalid path"},{status:400});
 try {const r=await fetch(`${backend}/api/portfolios/1/watchlists/${id}/items/${encodeURIComponent(symbol)}`,{method:"DELETE"});return r.status===204?new Response(null,{status:204}):NextResponse.json({error:"Unable to remove asset"},{status:r.status});}
 catch{return NextResponse.json({error:"Watchlist service unavailable"},{status:503});}
}
