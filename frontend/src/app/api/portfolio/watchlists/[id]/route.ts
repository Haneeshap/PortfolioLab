import { NextResponse } from "next/server";
const backend = process.env.BACKEND_URL ?? "http://localhost:8080";
const base = `${backend}/api/portfolios/1/watchlists`;
type Context = { params: Promise<{id:string}> };
export async function PATCH(request:Request,context:Context) {
 const {id}=await context.params; if(!/^\d+$/.test(id)) return NextResponse.json({error:"Invalid ID"},{status:400});
 try {const r=await fetch(`${base}/${id}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(await request.json())}); return r.status===204?new Response(null,{status:204}):NextResponse.json({error:"Rename failed"},{status:r.status});}
 catch{return NextResponse.json({error:"Watchlist service unavailable"},{status:503});}
}
export async function DELETE(_request:Request,context:Context) {
 const {id}=await context.params; if(!/^\d+$/.test(id)) return NextResponse.json({error:"Invalid ID"},{status:400});
 try {const r=await fetch(`${base}/${id}`,{method:"DELETE"}); return r.status===204?new Response(null,{status:204}):NextResponse.json({error:"Delete failed"},{status:r.status});}
 catch{return NextResponse.json({error:"Watchlist service unavailable"},{status:503});}
}
