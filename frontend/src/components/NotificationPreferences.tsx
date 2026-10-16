"use client";
import { useEffect, useState } from "react";
export default function NotificationPreferences() {
 const [settings,setSettings]=useState<Record<string,boolean>>({});
 const [message,setMessage]=useState("");const [busy,setBusy]=useState(false);
 useEffect(()=>{let active=true;fetch("/api/portfolio/notifications/preferences",{cache:"no-store"}).then(async r=>{if(!r.ok)throw new Error();const data=await r.json();if(active)setSettings(data);}).catch(()=>{if(active)setMessage("Unable to load preferences. Reload to retry.");});return()=>{active=false;};},[]);
 async function save(){setBusy(true);try{const r=await fetch("/api/portfolio/notifications/preferences",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(settings)});if(!r.ok)throw new Error();setSettings(await r.json());setMessage("Preferences saved.");}catch{setMessage("Unable to save preferences.");}finally{setBusy(false);}}
 return <details className="rounded-xl border border-slate-700 p-4"><summary>Notification preferences</summary>
 <p className="my-3 text-sm text-slate-400">Applied when each event is processed. Activity history is independent. Price alerts still use your existing thresholds. Replayed events never create another notice.</p>
 <div className="flex flex-wrap gap-4">{Object.entries(settings).map(([type,enabled])=><label key={type} className="text-sm"><input type="checkbox" checked={enabled} disabled={busy} onChange={e=>setSettings(s=>({...s,[type]:e.target.checked}))}/> {type.toLowerCase().replaceAll("_"," ")}</label>)}</div>
 <button disabled={busy || !Object.keys(settings).length} className="mt-4 underline disabled:opacity-50" onClick={()=>void save()}>Save preferences</button><p role="status">{message}</p></details>;
}
