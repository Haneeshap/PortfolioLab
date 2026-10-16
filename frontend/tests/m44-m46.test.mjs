import test from "node:test";
import assert from "node:assert/strict";
import { GET, POST } from "../src/app/api/portfolio/intelligence/route.ts";

test("performance proxy is scoped, bounded and uncached", async t => {
  let call;
  t.mock.method(globalThis, "fetch", async (url, init) => { call = {url, init}; return Response.json({status:"PARTIAL",returnPct:null}); });
  const response = await GET(new Request("http://local?period=7D&portfolioId=999"));
  assert.match(call.url,/portfolios\/1\/performance\?period=7D$/);
  assert.equal(call.init.cache,"no-store");assert.equal((await response.json()).returnPct,null);
  assert.equal((await GET(new Request("http://local?period=10Y"))).status,400);
});
test("planner forwards targets only, never order submission", async t => {
  let call;
  t.mock.method(globalThis,"fetch",async(url,init)=>{call={url,init};return Response.json({projectedCash:100});});
  await POST(new Request("http://local?portfolioId=9",{method:"POST",body:JSON.stringify({assets:{5:60},cashPct:40,execute:true,portfolioId:9})}));
  assert.match(call.url,/portfolios\/1\/rebalance\/preview$/);assert.equal(call.init.method,"POST");
  assert.deepEqual(JSON.parse(call.init.body),{assets:{5:60},cashPct:40});
});
test("invalid target and unavailable quote failures are recoverable",async t=>{
  t.mock.method(globalThis,"fetch",async()=>Response.json({}, {status:400}));
  const response=await POST(new Request("http://local",{method:"POST",body:JSON.stringify({assets:{},cashPct:70})}));
  assert.equal(response.status,400);assert.match((await response.json()).error,/100%/);
});
test("network errors do not expose backend details",async t=>{
  t.mock.method(globalThis,"fetch",async()=>{throw new Error("private detail");});
  const response=await GET(new Request("http://local"));assert.equal(response.status,503);assert.doesNotMatch(await response.text(),/private detail/);
});
test("malformed planner input fails before backend access",async t=>{
  let calls=0;t.mock.method(globalThis,"fetch",async()=>{calls++;return Response.json({});});
  for(const body of ["null","[]","bad json"])assert.equal((await POST(new Request("http://local",{method:"POST",body}))).status,400);
  assert.equal(calls,0);
});
