async function proxy(request: Request) {
 try {
  const response=await fetch(`${process.env.BACKEND_URL ?? "http://localhost:8080"}/api/portfolios/1/activity${new URL(request.url).search}`,{method:request.method,headers:{"Content-Type":"application/json"},body:request.method==="PUT"?await request.text():undefined,cache:"no-store"});
  return new Response(await response.text(),{status:response.status,headers:{"Content-Type":"application/json","Cache-Control":"no-store"}});
 }catch{return Response.json({error:"Service unavailable"},{status:503});}
}
export const GET=proxy;
