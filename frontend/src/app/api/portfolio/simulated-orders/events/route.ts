export async function GET(request: Request) {
 const controller=new AbortController();
 const abort=()=>controller.abort();
 const connectTimeout=setTimeout(abort,15000);
 request.signal.addEventListener("abort",abort,{once:true});
 try {
  const last=request.headers.get("last-event-id");
  const response=await fetch(`${process.env.BACKEND_URL ?? "http://localhost:8080"}/api/portfolios/1/simulated-orders/events`,{
   headers:last && /^\d{1,19}$/.test(last)?{"Last-Event-ID":last}:undefined,
   cache:"no-store",redirect:"error",signal:AbortSignal.any([controller.signal,request.signal])
  });
  clearTimeout(connectTimeout);
  if(!response.ok || !response.body || !response.headers.get("content-type")?.includes("text/event-stream")) {
   controller.abort();request.signal.removeEventListener("abort",abort);return new Response("Order stream unavailable",{status:503});
  }
  const reader=response.body.getReader();
  const body=new ReadableStream<Uint8Array>({
   async pull(target){try {const value=await reader.read();if(value.done){request.signal.removeEventListener("abort",abort);target.close();}else target.enqueue(value.value);}catch(error){target.error(error);controller.abort();}},
   async cancel(){controller.abort();request.signal.removeEventListener("abort",abort);await reader.cancel();}
  });
  return new Response(body,{headers:{"Content-Type":"text/event-stream","Cache-Control":"no-cache, no-transform","X-Accel-Buffering":"no"}});
 }catch {clearTimeout(connectTimeout);controller.abort();request.signal.removeEventListener("abort",abort);return new Response("Order stream unavailable",{status:503});}
}
