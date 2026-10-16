import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {validOrderInput,parseOrder,isActiveOrder} from "../src/lib/simulated-orders.ts";
import {RecentOrderRow} from "../src/components/RecentOrders.tsx";
import {POST as submit} from "../src/app/api/portfolio/simulated-orders/route.ts";
import {GET as streamProxy} from "../src/app/api/portfolio/simulated-orders/events/route.ts";
import {startOrderUpdates} from "../src/lib/order-updates.ts";
const flush=()=>new Promise(resolve=>setImmediate(resolve));
const input={assetId:3,type:"BUY",quantity:4,orderType:"LIMIT",limitPrice:90,timeInForce:"DAY"};
const row={id:1,portfolioId:1,assetId:3,side:"BUY",requestedQuantity:4,filledQuantity:0,status:"ACCEPTED",failureReason:null,orderType:"LIMIT",limitPrice:90,timeInForce:"DAY",expiresAt:"2026-10-16T18:30:00Z"};
class FakeStream extends EventTarget {closed=false;close(){this.closed=true;} emit(type,data){this.dispatchEvent(data===undefined?new Event(type):new MessageEvent(type,{data:JSON.stringify(data)}));}}
function fixture(read=async()=>[row]) {
 const source=new FakeStream();const snapshots=[];const errors=[];let changes=0;
 const stop=startOrderUpdates({initial:[],read,onSnapshot:r=>snapshots.push(r),onPortfolioChange:async()=>{changes++;},onError:e=>errors.push(e),onPaused:()=>{}},()=>source);
 return {source,snapshots,errors,stop,get changes(){return changes;}};
}
test("limit validation rejects missing, negative, nonfinite and excessive-precision prices",()=>{
 assert.equal(validOrderInput(input),true);
 for(const limitPrice of [undefined,0,-1,Infinity,NaN,0.00001,1e16]) assert.equal(validOrderInput({...input,limitPrice}),false);
 assert.equal(validOrderInput({...input,timeInForce:"IOC"}),false);
 assert.equal(validOrderInput({...input,orderType:"MARKET"}),false);
});
test("proxy forwards limit and expiration inputs within demo portfolio",async t=>{
 let payload;
 t.mock.method(globalThis,"fetch",async(url,init)=>{assert.match(url,/portfolios\/1\/simulated-orders$/);payload=JSON.parse(init.body);return Response.json(row,{status:201});});
 const response=await submit(new Request("http://local",{method:"POST",body:JSON.stringify({...input,portfolioId:99})}));
 assert.equal(response.status,201);assert.deepEqual(payload,input);
 assert.equal((await response.json()).limitPrice,90);
});
test("expired partial orders display preserved fills and cannot cancel",()=>{
 const order=parseOrder({...row,status:"EXPIRED",filledQuantity:2});
 assert.equal(isActiveOrder(order),false);
 const html=renderToStaticMarkup(React.createElement(RecentOrderRow,{order,symbol:"DEMO",cancelling:null,onView(){},onCancel(){}}));
 assert.match(html,/EXPIRED/);assert.match(html,/LIMIT/);assert.match(html,/90/);assert.match(html,/disabled/);
});
test("events refresh existing order and portfolio views; duplicates and wrong portfolio are ignored",async()=>{
 const f=fixture();await flush();const initial=f.snapshots.length;
 f.source.emit("order",{eventId:2,portfolioId:1});await flush();assert.equal(f.snapshots.length,initial+1);
 f.source.emit("order",{eventId:2,portfolioId:1});f.source.emit("order",{eventId:1,portfolioId:1});f.source.emit("order",{eventId:3,portfolioId:99});await flush();
 assert.equal(f.snapshots.length,initial+1);assert.equal(f.changes,f.snapshots.length);f.stop();
});
test("reconnection and reset recover missed events using authoritative HTTP",async()=>{
 const f=fixture();await flush();const initial=f.changes;
 f.source.emit("error");await flush();f.source.emit("open");await flush();f.source.emit("reset",{portfolioId:1});await flush();
 assert.ok(f.changes>=initial+2);f.stop();assert.equal(f.source.closed,true);
});
test("burst events coalesce and cleanup prevents late frontend updates",async()=>{
 let resolve;let reads=0;
 const f=fixture(signal=>{reads++;return new Promise(r=>{resolve=r;signal.addEventListener("abort",()=>{});});});
 f.source.emit("order",{eventId:1,portfolioId:1});f.source.emit("order",{eventId:2,portfolioId:1});
 assert.equal(reads,1);f.stop();resolve([row]);await flush();assert.equal(f.snapshots.length,0);
 f.source.emit("order",{eventId:3,portfolioId:1});assert.equal(reads,1);
});
test("SSE proxy preserves cursor and streams data without buffering",async t=>{
 t.mock.method(globalThis,"fetch",async(url,init)=>{
  assert.match(url,/portfolios\/1\/simulated-orders\/events$/);assert.equal(init.headers["Last-Event-ID"],"42");
  return new Response("event: order\nid: 43\ndata: {}\n\n",{headers:{"Content-Type":"text/event-stream"}});
 });
 const response=await streamProxy(new Request("http://local?portfolioId=99",{headers:{"Last-Event-ID":"42"}}));
 assert.equal(response.headers.get("content-type"),"text/event-stream");assert.match(await response.text(),/id: 43/);
});
test("SSE proxy fails closed when upstream does not stream",async t=>{
 t.mock.method(globalThis,"fetch",async()=>Response.json({error:"internal"}));
 assert.equal((await streamProxy(new Request("http://local"))).status,503);
});

test("failed event refresh retries authoritative evidence",async()=>{
 const source=new FakeStream();const timers=[];let reads=0;let changes=0;
 const stop=startOrderUpdates({initial:[],read:async()=>{if(++reads===1)throw Error("temporary");return [row];},
  onSnapshot:()=>{},onPortfolioChange:async()=>{changes++;},onError:()=>{},onPaused:()=>{},
  schedule:callback=>{timers.push(callback);return timers.length;},unschedule:()=>{}},()=>source);
 await flush();assert.equal(timers.length,1);timers.shift()();await flush();assert.equal(changes,1);stop();
});
