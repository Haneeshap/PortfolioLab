type Stream = Pick<EventSource,"addEventListener" | "close">;
/** Invalidation only: persisted HTTP state recovers gaps on every reconnect. */
export function startNotificationUpdates(refresh:()=>void,create:()=>Stream=()=>new EventSource("/api/portfolio/simulated-orders/events")) {
 const stream=create();let timer:ReturnType<typeof setTimeout>|undefined;let stopped=false;
 const changed=(event:Event)=>{
  try{if(JSON.parse((event as MessageEvent).data).portfolioId!==1)return;}catch{return;}
  if(stopped || timer)return;
  timer=setTimeout(()=>{timer=undefined;if(!stopped)refresh();},100);
 };
 stream.addEventListener("reset",changed);stream.addEventListener("notification",changed);
 return ()=>{stopped=true;if(timer)clearTimeout(timer);stream.close();};
}
