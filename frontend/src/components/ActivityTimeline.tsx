"use client";
import Link from "next/link";
import { useEffect,useRef,useState } from "react";
type Entry={key:string;occurred_at:string;type:string;order_id:number|null;transaction_id:number|null;description:string};
const types=["ALL","SUBMITTED","ACCEPTED","PARTIALLY_FILLED","FILLED","CANCELLED","EXPIRED","REJECTED","SETTLED","DIVIDEND","LEGACY_ORDER"];
export default function ActivityTimeline(){
 const [items,setItems]=useState<Entry[]>([]);const [type,setType]=useState("ALL");
 const [error,setError]=useState("");const [busy,setBusy]=useState(false);const [more,setMore]=useState(false);const generation=useRef(0);
 async function load(filter:string,append:boolean,signal?:AbortSignal){
  const request=++generation.current;setBusy(true);setError("");
  const query=new URLSearchParams({type:filter});const last=append?items.at(-1):null;
  if(last){query.set("beforeTime",last.occurred_at);query.set("beforeKey",last.key);}
  try{const r=await fetch(`/api/portfolio/activity?${query}`,{cache:"no-store",signal});if(!r.ok)throw new Error();const data:Entry[]=await r.json();if(request===generation.current){setItems(current=>append?[...current,...data]:data);setMore(data.length===50);}}
  catch{if(!signal?.aborted && request===generation.current)setError("Activity unavailable. Retry with Refresh.");}
  finally{if(request===generation.current)setBusy(false);}
 }
 // Initial/filter fetch synchronizes persisted activity; no derived-state calculation.
 // eslint-disable-next-line react-hooks/set-state-in-effect
 useEffect(()=>{const controller=new AbortController();void load(type,false,controller.signal);return()=>controller.abort();},[type]); // eslint-disable-line react-hooks/exhaustive-deps
 return <section className="space-y-4"><h2 className="text-2xl font-semibold">Activity timeline</h2>
 <p className="text-sm text-slate-400">Persisted simulated order history, settlements and dividends, independent of unread notifications. Older orders may lack lifecycle detail.</p>
 <label>Event type <select value={type} onChange={e=>setType(e.target.value)} className="bg-slate-900 p-2">{types.map(t=><option key={t}>{t}</option>)}</select></label>
 <button className="ml-4 underline" disabled={busy} onClick={()=>void load(type,false)}>Refresh</button>
 {error && <p role="alert">{error}</p>}{!busy && !items.length && !error && <p>No activity recorded.</p>}
 <ol>{items.map(e=><li key={e.key} className="border-b border-slate-800 py-4"><time className="text-xs text-slate-400">{new Date(e.occurred_at).toLocaleString()}</time><p>{e.description}</p>
 {e.order_id && <Link className="mr-4 text-emerald-400 underline" href={`/portfolio?orderId=${e.order_id}`}>Order #{e.order_id}</Link>}
 {e.transaction_id && <Link className="text-emerald-400 underline" href={`#transaction-${e.transaction_id}`}>Transaction #{e.transaction_id}</Link>}</li>)}</ol>
 {more && <button className="underline" disabled={busy} onClick={()=>void load(type,true)}>Load older activity</button>}{busy && <p role="status">Loading activity...</p>}</section>;
}
