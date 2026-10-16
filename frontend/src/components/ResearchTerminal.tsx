"use client";
import {useEffect,useState} from "react";
import {ComposedChart,Line,Bar,BarChart,XAxis,YAxis,Tooltip,ResponsiveContainer,CartesianGrid} from "recharts";
import {dateRange,replayNext,publishResearchContext,type Research} from "@/lib/research";
import Link from "next/link";
type Asset={id:number;symbol:string;name:string};
type CandleProps={x?:number;y?:number;width?:number;height?:number;payload?:{open:number;close:number;high:number;low:number}};
function CandleShape({x=0,y=0,width=0,height=0,payload}:CandleProps){if(!payload)return <g/>;const {open,close,high,low}=payload;const span=high-low||1;const top=y+(high-Math.max(open,close))/span*height;const body=Math.max(1,Math.abs(close-open)/span*height);const color=close>=open?"#34d399":"#fb7185";return <g><line x1={x+width/2} x2={x+width/2} y1={y} y2={y+height} stroke={color}/><rect x={x} y={top} width={Math.max(1,width)} height={body} fill={color}/></g>;}
function CandleTooltip({active,payload}:{active?:boolean;payload?:readonly {payload?:unknown}[]}){
 const row=payload?.[0]?.payload as {date:string;open:number;high:number;low:number;close:number;sma:number|null;ema:number|null;volume:number}|undefined;
 if(!active||!row)return null;return <div className="rounded border border-slate-600 bg-slate-950 p-3 text-xs"><strong>{row.date} - fictional</strong><p>Open {row.open.toFixed(4)} / High {row.high.toFixed(4)}</p><p>Low {row.low.toFixed(4)} / Close {row.close.toFixed(4)}</p><p>Volume {row.volume.toLocaleString()}</p><p>SMA {row.sma?.toFixed(2)??"warm-up"} / EMA {row.ema?.toFixed(2)??"warm-up"}</p></div>;
}
export default function ResearchTerminal({assets,initialAssetId}:{assets:Asset[];initialAssetId?:number}){
 const [assetId,setAssetId]=useState(assets.some(a=>a.id===initialAssetId)?initialAssetId!:assets[0]?.id??0);const [range,setRange]=useState(()=>dateRange(90));const [period,setPeriod]=useState(14);
 const [result,setResult]=useState<Research|null>(null);const [error,setError]=useState("");const [loading,setLoading]=useState(true);const [retry,setRetry]=useState(0);
 const [mode,setMode]=useState<"candle"|"line">("candle");const [index,setIndex]=useState<number|null>(null);const [playing,setPlaying]=useState(false);
 useEffect(()=>{const controller=new AbortController();
  void fetch(`/api/research/assets/${assetId}/history?${new URLSearchParams({...range,period:String(period)})}`,{signal:controller.signal,cache:"no-store"}).then(async r=>{if(!r.ok)throw Error("Unable to load research. Use completed UTC days since 2025-01-01, up to 366 days.");return r.json();}).then((data:Research)=>{if(!controller.signal.aborted){setResult(data);setError("");setLoading(false);}}).catch(e=>{if(!controller.signal.aborted){setError(String(e.message));setLoading(false);}});
  return()=>controller.abort();
 },[assetId,range,period,retry]);
 useEffect(()=>{if(!playing||(index??0)>=(result?.bars.length??0))return;const timer=setTimeout(()=>setIndex(i=>replayNext(i??0,result?.bars.length??0)),650);return()=>clearTimeout(timer);},[playing,result,index]);
 useEffect(()=>{publishResearchContext({assetId,...range,period});return()=>publishResearchContext(null);},[assetId,range,period]);
 function change(){setPlaying(false);setIndex(null);setResult(null);setLoading(true);setError("");}
 const visible=result?.bars.slice(0,index??result.bars.length)??[];const last=visible.at(-1);const complete=index!==null&&index>=(result?.bars.length??0);
 const chart=visible.map(({candle,indicators})=>({...candle,...indicators,date:candle.time.slice(0,10),wick:[candle.low,candle.high]}));
 const value=(n:number|null|undefined)=>n==null?"Warm-up / unavailable":n.toFixed(2);
 return <section className="space-y-5"><div className="flex flex-wrap justify-between gap-3"><div><h2 className="text-2xl font-semibold">Market Research Terminal</h2><p className="text-sm text-slate-400">Generated fictional history. Daily UTC candles; independent of live trading prices.</p></div><Link href="/portfolio/risk" className="text-emerald-400 underline">Open Portfolio Risk Lab</Link></div>
 {!assets.length&&<p role="alert">No fictional assets are available. Start the backend and reload the catalog.</p>}
 <div className="flex flex-wrap gap-4 rounded-xl border border-slate-700 p-4">
 <label>Fictional asset<select aria-label="Research asset" className="block bg-slate-900 p-2" value={assetId} onChange={e=>{change();setAssetId(Number(e.target.value));}}>{assets.map(a=><option key={a.id} value={a.id}>{a.symbol} - {a.name}</option>)}</select></label>
 <label>From<input type="date" min="2025-01-01" value={range.from} className="block bg-slate-900 p-2" onChange={e=>{change();setRange({...range,from:e.target.value});}}/></label><label>To (exclusive)<input type="date" value={range.to} max={dateRange(1).to} className="block bg-slate-900 p-2" onChange={e=>{change();setRange({...range,to:e.target.value});}}/></label>
 <label>Indicator period<select className="block bg-slate-900 p-2" value={period} onChange={e=>{change();setPeriod(Number(e.target.value));}}>{[7,14,20,50].map(n=><option key={n}>{n}</option>)}</select></label>
 <div className="flex items-end gap-2">{[30,90,180,365].map(d=><button className="rounded border border-slate-600 p-2" key={d} onClick={()=>{change();setRange(dateRange(d));}}>{d}D</button>)}</div></div>
 {loading&&<p role="status">Loading bounded fictional history...</p>}{error&&<div role="alert">{error} <button className="underline" onClick={()=>{change();setRetry(n=>n+1);}}>Retry</button></div>}
 {result&&!loading&&<><div className="flex flex-wrap items-center gap-3"><button className="rounded border p-2" onClick={()=>setMode(m=>m==="line"?"candle":"line")}>{mode==="line"?"Show candlesticks":"Show line"}</button>
 <button className="rounded border p-2" disabled={!result.bars.length} onClick={()=>{setIndex(1);setPlaying(true);}}>Start replay</button><button className="rounded border p-2" disabled={index===null||complete} onClick={()=>setPlaying(p=>!p)}>{playing&&!complete?"Pause":"Resume"}</button><button className="rounded border p-2" onClick={()=>{setIndex(null);setPlaying(false);}}>Reset</button><span aria-live="polite">{index===null?"Full period":`Replay ${visible.length}/${result.bars.length} - ${last?.candle.time.slice(0,10)??"ready"}${complete?" (complete)":""}`}</span></div>
 <p className="text-sm text-amber-300">Replay is local and read-only. It cannot change market prices, orders, reservations or balances.</p>
 {result.warnings.map(w=><p className="text-amber-300" key={w}>{w}</p>)}
 {!chart.length?<p>No candles available for this period.</p>:<div className="rounded-xl border border-slate-700 p-3"><div style={{height:340}}><ResponsiveContainer width="100%" height="100%"><ComposedChart data={chart}><CartesianGrid stroke="#334155" strokeDasharray="3 3"/><XAxis dataKey="date" minTickGap={55}/><YAxis domain={['auto','auto']} width={65}/><Tooltip content={props=><CandleTooltip active={props.active} payload={props.payload}/>}/>{mode==="line"?<Line dataKey="close" stroke="#38bdf8" dot={false}/>:<Bar dataKey="wick" name="Low / High" fill="#34d399" shape={(props:unknown)=><CandleShape {...props as CandleProps}/>}/>}<Line dataKey="sma" stroke="#fbbf24" dot={false} connectNulls={false}/><Line dataKey="ema" stroke="#a78bfa" dot={false} connectNulls={false}/></ComposedChart></ResponsiveContainer></div><div style={{height:110}}><ResponsiveContainer width="100%" height="100%"><BarChart data={chart}><XAxis dataKey="date" hide/><YAxis width={65}/><Tooltip/><Bar dataKey="volume" fill="#64748b"/></BarChart></ResponsiveContainer></div></div>}
 <div className="grid gap-3 sm:grid-cols-3">{[["RSI",value(last?.indicators.rsi)],["Annualized realized volatility (%)",value(last?.indicators.realizedVolatility)],["Daily change (%)",value(last?.indicators.changePct)]].map(([title,v])=><div key={title} className="rounded-xl border border-slate-700 p-4"><p className="text-sm text-slate-400">{title}</p><strong>{v}</strong></div>)}</div><details className="rounded-xl border border-slate-700 p-4"><summary>Definitions and data provenance</summary><p className="mt-2 text-sm">{result.methodology}</p><p className="mt-2 text-sm">{result.source}; missing days: {result.missingDays}. Indicators use only currently visible replay candles. They are descriptive, not guaranteed signals.</p></details></>}
 </section>;
}
