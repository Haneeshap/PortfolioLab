import { startOrderPolling, type PollOptions } from "./order-polling";
import { DEMO_PORTFOLIO_ID } from "./simulated-orders";

type Stream = Pick<EventSource,"addEventListener" | "close">;
// Events invalidate HTTP evidence; never use an event to invent balances or fills.
export function startOrderUpdates(options: PollOptions, create: () => Stream = () => new EventSource("/api/portfolio/simulated-orders/events")): () => void {
 let stopped=false, busy=false, dirty=false, connected=false, fallback=false, last=0;
 let stopFallback=()=>{};
 let failures=0;
 let retryTimer:ReturnType<typeof setTimeout>|undefined;
 const schedule=options.schedule??setTimeout,unschedule=options.unschedule??clearTimeout;
 const controller=new AbortController();
 async function refresh() {
  if(retryTimer!==undefined){unschedule(retryTimer);retryTimer=undefined;}
  dirty=true;
  if(busy || stopped) return;
  busy=true;
  try {
   while(dirty && !stopped) {
    dirty=false;
    const rows=await options.read(controller.signal);
    if(stopped) return;
    options.onSnapshot(rows);
    await options.onPortfolioChange();
    if(!stopped){failures=0;options.onError(null);}
   }
  }catch(error){
   if(!stopped){
    options.onError(error instanceof Error?error.message:"Order refresh failed. Refresh orders to retry.");
    if(++failures<3) retryTimer=schedule(()=>{retryTimer=undefined;void refresh();},3000);
   }
  }
  finally {busy=false;}
 }
 let stream:Stream;
 function unavailable() {
  connected=false;
  if(stopped || fallback) return;
  fallback=true;
  stopFallback=startOrderPolling({...options, intervalMs:5000,maxRequests:60});
 }
 try {stream=create();}catch {unavailable();return ()=>{stopped=true;controller.abort();stopFallback();};}
 stream.addEventListener("open",()=>{
  if(stopped)return;
  connected=true;fallback=false;stopFallback();void refresh();
 });
 stream.addEventListener("reset",()=>{last=0;if(!stopped)void refresh();});
 stream.addEventListener("order",raw=>{
  if(stopped)return;
  try {
   const event=JSON.parse((raw as MessageEvent).data);
   if(event.portfolioId!==DEMO_PORTFOLIO_ID || !Number.isSafeInteger(event.eventId) || event.eventId<=0) return;
   if(event.eventId<=last) return;
   last=event.eventId;
   void refresh();
  }catch {if(connected) void refresh();}
 });
 stream.addEventListener("error",unavailable);
 void refresh();
 return ()=>{stopped=true;controller.abort();stream.close();stopFallback();if(retryTimer!==undefined)unschedule(retryTimer);};
}
