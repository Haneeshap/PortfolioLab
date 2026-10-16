export async function GET(request: Request) {
 try {
  const response=await fetch(`${process.env.BACKEND_URL ?? "http://localhost:8080"}/api/portfolios/1/simulated-orders/availability`,{cache:"no-store",signal:AbortSignal.any([request.signal,AbortSignal.timeout(10000)])});
  if(!response.ok) return Response.json({error:"Buying power unavailable"},{status:503});
  return Response.json(await response.json(),{headers:{"Cache-Control":"no-store"}});
 } catch { return Response.json({error:"Buying power unavailable"},{status:503}); }
}
