"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import "./intelligence.css";
import { useMarketPrices } from "@/components/MarketPriceProvider";
type Event = { id:number; symbol:string; currency:string; eventType:"SURGE"|"DROP"; windowSeconds:number; startPrice:number; endPrice:number; changePercent:number; headline:string; explanation:string; createdAt:string };
type Scope="all"|"watchlist";
type Direction="all"|"SURGE"|"DROP";
const number=(n:number)=>new Intl.NumberFormat("en-IN",{maximumFractionDigits:2}).format(n);
export default function IntelligencePage(){
 const [scope,setScope]=useState<Scope>("all");const [type,setType]=useState<Direction>("all");
 const [events,setEvents]=useState<Event[]>([]);const [error,setError]=useState("");const [loading,setLoading]=useState(true);
 const [lastUpdated,setLastUpdated]=useState<Date|null>(null);
 const {status}=useMarketPrices();
 const refresh=useCallback(async()=>{
  try {const r=await fetch(`/api/market/intelligence?scope=${scope}&type=${type}`,{cache:"no-store"});
   if(!r.ok)throw Error(`Intelligence API returned ${r.status}`);
   const data:unknown=await r.json();if(!Array.isArray(data))throw Error("Unexpected intelligence response");
   setEvents(data as Event[]);setError("");setLastUpdated(new Date());
  }catch(e){setError(e instanceof Error?e.message:"Unable to load intelligence");}finally{setLoading(false);}
 },[scope,type]);
 useEffect(()=>{const first=window.setTimeout(()=>void refresh(),0);const timer=window.setInterval(()=>void refresh(),10000);return()=>{window.clearTimeout(first);window.clearInterval(timer);};},[refresh]);
 const rises=useMemo(()=>events.filter(e=>e.eventType==="SURGE").length,[events]);
 const drops=events.length-rises;
 return <div className="mi-page">
  <section className="mi-hero"><div><p className="mi-eyebrow">PORTFOLIOLAB / MARKET SIGNALS</p><h2>Market intelligence<span className="mi-dot">.</span></h2><p>Meaningful moves across 25 fictional assets, explained with real simulated price observations—not invented news.</p></div><span className="mi-live"><span className="mi-pulse"/>{status==="connected"?"Simulator connected":"Simulator reconnecting"}</span></section>
  <div className="mi-stats"><div><span>Recorded signals</span><strong>{events.length}</strong><small>Current feed</small></div><div><span>Upward moves</span><strong className="mi-positive">{rises}</strong><small>Above detection threshold</small></div><div><span>Downward moves</span><strong className="mi-negative">{drops}</strong><small>Below detection threshold</small></div><div><span>Observation windows</span><strong>1m <em>/</em> 5m</strong><small>3% and 6% thresholds</small></div></div>
  <section className="mi-panel"><div className="mi-toolbar"><div><h3>Intelligence stream</h3><p>Automatically detected · 10-minute cooldown per asset and direction</p></div><button className="mi-refresh" onClick={()=>void refresh()}>↻ Refresh</button></div>
   <div className="mi-filters"><div role="group" aria-label="Asset scope">{(["all","watchlist"] as Scope[]).map(s=><button key={s} aria-pressed={scope===s} className={scope===s?"mi-selected":""} onClick={()=>setScope(s)}>{s==="all"?"All assets":"My watchlists"}</button>)}</div><div role="group" aria-label="Movement direction">{(["all","SURGE","DROP"] as Direction[]).map(t=><button key={t} aria-pressed={type===t} className={type===t?"mi-selected":""} onClick={()=>setType(t)}>{t==="all"?"All movements":t==="SURGE"?"Rising":"Falling"}</button>)}</div></div>
   {error&&<p className="mi-error" role="alert">{error}</p>}
   {loading?<div className="mi-empty">Loading intelligence…</div>:events.length===0?<div className="mi-empty"><div className="mi-empty-icon">◎</div><h4>No signals yet</h4><p>The engine needs at least a minute of simulated price history. Only significant changes generate events; a quiet feed is normal.</p><Link href="/watchlists">Manage watchlists ↗</Link></div>:<div className="mi-events">{events.map(e=><article key={e.id} className="mi-event"><div className={`mi-event-icon ${e.eventType==="SURGE"?"mi-up":"mi-down"}`}>{e.eventType==="SURGE"?"↗":"↘"}</div><div className="mi-event-content"><div className="mi-event-meta"><span className="mi-symbol">{e.symbol}</span><span className={`mi-direction ${e.eventType==="SURGE"?"mi-positive":"mi-negative"}`}>{e.eventType==="SURGE"?"Upward move":"Downward move"}</span><span>· {e.windowSeconds/60} min window</span></div><h4>{e.headline}</h4><p>{e.explanation}</p><div className="mi-event-footer"><time dateTime={e.createdAt}>{new Date(e.createdAt).toLocaleString()}</time><Link href={`/alerts?symbol=${encodeURIComponent(e.symbol)}`}>Create price alert ↗</Link></div></div><strong className={`mi-change ${e.changePercent>=0?"mi-positive":"mi-negative"}`}>{e.changePercent>0?"+":""}{number(e.changePercent)}%</strong></article>)}</div>}
   <footer className="mi-footer">{lastUpdated?`Last refreshed ${lastUpdated.toLocaleTimeString()}`:"Waiting for first update"} · Educational simulation only · No investment recommendations</footer>
  </section>
 </div>;
}
