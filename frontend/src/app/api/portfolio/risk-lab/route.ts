async function forward(request:Request,method:"GET"|"POST"){
 try{const body=method==="POST"?await request.json():undefined;
 const response=await fetch(`${process.env.BACKEND_URL??"http://localhost:8080"}/api/portfolios/1/risk-lab${method==="POST"?"/scenario":""}`,{method,headers:body?{"Content-Type":"application/json"}:undefined,body:body?JSON.stringify({broadShockPct:body.broadShockPct,assetShocks:body.assetShocks}):undefined,cache:"no-store",signal:AbortSignal.any([request.signal,AbortSignal.timeout(15000)])});
 if(!response.ok)return Response.json({error:"Risk calculation unavailable or invalid scenario"},{status:response.status});return Response.json(await response.json(),{headers:{"Cache-Control":"no-store"}});
 }catch{return Response.json({error:"Risk Lab unavailable"},{status:503});}
}
export async function GET(request:Request){return forward(request,"GET");}
export async function POST(request:Request){return forward(request,"POST");}
