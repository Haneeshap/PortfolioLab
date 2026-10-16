export async function GET(request:Request,context:{params:Promise<{assetId:string}>}) {
 const {assetId}=await context.params;const input=new URL(request.url);const query=new URLSearchParams();
 if(!/^[1-9]\d*$/.test(assetId))return Response.json({error:"Invalid asset"},{status:400});
 for(const key of ["from","to","period"])if(input.searchParams.has(key))query.set(key,input.searchParams.get(key)!);
 try{const response=await fetch(`${process.env.BACKEND_URL??"http://localhost:8080"}/api/research/assets/${assetId}/history?${query}`,{cache:"no-store",signal:AbortSignal.any([request.signal,AbortSignal.timeout(15000)])});
 if(!response.ok)return Response.json({error:"Research unavailable; check the date range and services"},{status:response.status});
 return Response.json(await response.json(),{headers:{"Cache-Control":"no-store"}});
 }catch{return Response.json({error:"Research service unavailable"},{status:503});}
}
