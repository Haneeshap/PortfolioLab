import test from "node:test";
import assert from "node:assert/strict";
import {startNotificationUpdates} from "../src/lib/notification-updates.ts";
import {GET as activity} from "../src/app/api/portfolio/activity/route.ts";
import {GET as notices} from "../src/app/api/portfolio/notifications/route.ts";
import {PUT as preferences} from "../src/app/api/portfolio/notifications/preferences/route.ts";
import {PATCH as unread} from "../src/app/api/portfolio/notifications/[id]/unread/route.ts";
class Stream extends EventTarget {closed=false;close(){this.closed=true;}emit(type,data){this.dispatchEvent(new MessageEvent(type,{data:JSON.stringify(data)}));}}
const pause=()=>new Promise(r=>setTimeout(r,140));
test("notification invalidations coalesce, recover on reconnect reset, isolate scope and stop on cleanup",async()=>{
 const source=new Stream();let calls=0;const stop=startNotificationUpdates(()=>calls++,()=>source);
 source.emit("notification",{portfolioId:2});await pause();assert.equal(calls,0);
 source.emit("reset",{portfolioId:1});source.emit("notification",{portfolioId:1});source.emit("notification",{portfolioId:1});
 await pause();assert.equal(calls,1);
 source.emit("reset",{portfolioId:1});await pause();assert.equal(calls,2);
 source.emit("notification",{portfolioId:1});stop();await pause();assert.equal(calls,2);assert.equal(source.closed,true);
});
test("activity and notification pagination stay scoped to demo portfolio",async t=>{
 const urls=[];t.mock.method(globalThis,"fetch",async(url)=>{urls.push(url);return Response.json([]);});
 await activity(new Request("http://local?type=SETTLED&beforeKey=transaction%3A123&portfolioId=55"));
 await notices(new Request("http://local?before=5&limit=20&portfolioId=55"));
 assert.match(urls[0],/portfolios\/1\/activity\?/);assert.match(urls[0],/beforeKey=transaction%3A123/);
 assert.match(urls[1],/portfolios\/1\/notifications\?before=5&limit=20/);
});
test("preferences and unread mutations preserve scope, method and failures",async t=>{
 let call;t.mock.method(globalThis,"fetch",async(url,init)=>{call={url,init};return Response.json({PRICE_ALERT:false});});
 await preferences(new Request("http://local?portfolioId=22",{method:"PUT",body:JSON.stringify({PRICE_ALERT:false})}));
 assert.match(call.url,/portfolios\/1\/notifications\/preferences/);assert.equal(call.init.method,"PUT");assert.deepEqual(JSON.parse(call.init.body),{PRICE_ALERT:false});
 await unread(new Request("http://local",{method:"PATCH"}),{params:Promise.resolve({id:"7"})});
 assert.match(call.url,/portfolios\/1\/notifications\/7\/unread$/);assert.equal(call.init.method,"PATCH");
 assert.equal((await unread(new Request("http://local"),{params:Promise.resolve({id:"bad"})})).status,400);
});
test("failed notification API calls produce recoverable service errors",async t=>{
 t.mock.method(globalThis,"fetch",async()=>{throw new Error("private detail");});
 const response=await activity(new Request("http://local"));assert.equal(response.status,503);assert.doesNotMatch(await response.text(),/private detail/);
});
