export type ResearchContext={assetId?:number;from?:string;to?:string;period?:number;scenario?:{broadShockPct:number;assetShocks?:Record<string,number>}};
let selectedContext:ResearchContext|null=null;
export function getResearchContext(){return selectedContext;}
export function subscribeResearchContext(listener:()=>void){window.addEventListener("portfoliolab-research-context",listener);return()=>window.removeEventListener("portfoliolab-research-context",listener);}
export function publishResearchContext(context:ResearchContext|null){selectedContext=context;window.dispatchEvent(new CustomEvent("portfoliolab-research-context",{detail:context}));}
export function replayNext(index:number,length:number){return Math.min(length,Math.max(0,index)+1);}
export function dateRange(days:number,today=new Date()){const to=new Date(Date.UTC(today.getUTCFullYear(),today.getUTCMonth(),today.getUTCDate()));const from=new Date(to.getTime()-days*86400000);return {from:from.toISOString().slice(0,10),to:to.toISOString().slice(0,10)};}
export type Bar={candle:{time:string;open:number;high:number;low:number;close:number;volume:number};indicators:{sma:number|null;ema:number|null;rsi:number|null;realizedVolatility:number|null;change:number|null;changePct:number|null}};
export type Research={assetId:number;symbol:string;currency:string;source:string;from:string;to:string;period:number;missingDays:number;warnings:string[];bars:Bar[];methodology:string};
