import { NextResponse } from "next/server";
const backend = process.env.BACKEND_URL ?? "http://localhost:8080";
const base = `${backend}/api/portfolios/1/watchlists`;
export async function GET() {
 try { const r=await fetch(base,{cache:"no-store"}); return NextResponse.json(await r.json(),{status:r.status}); }
 catch { return NextResponse.json({error:"Watchlist service unavailable"},{status:503}); }
}
export async function POST(request:Request) {
 try { const r=await fetch(base,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(await request.json())}); return NextResponse.json(await r.json(),{status:r.status}); }
 catch { return NextResponse.json({error:"Unable to create watchlist"},{status:503}); }
}
