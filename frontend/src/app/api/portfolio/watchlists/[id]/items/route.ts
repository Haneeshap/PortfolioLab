import { NextResponse } from "next/server";
const backend = process.env.BACKEND_URL ?? "http://localhost:8080";
const base = `${backend}/api/portfolios/1/watchlists`;
type Context={params:Promise<{id:string}>};
export async function POST(request:Request,context:Context) {
 const {id}=await context.params; if(!/^\d+$/.test(id))return NextResponse.json({error:"Invalid ID"},{status:400});
 try {const r=await fetch(`${base}/${id}/items`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(await request.json())});return r.status===201?NextResponse.json({ok:true},{status:201}):NextResponse.json({error:"Could not add asset (duplicate or invalid symbol)"},{status:r.status});}
 catch{return NextResponse.json({error:"Watchlist service unavailable"},{status:503});}
}
