"use client";
export default function ResearchError({reset}:{reset:()=>void}){return <section className="rounded-xl border border-amber-500 p-5" role="alert"><h2 className="font-semibold">Research catalog unavailable</h2><p>Check the local backend and PostgreSQL, then retry. No historical data was invented.</p><button className="mt-3 underline" onClick={reset}>Retry research</button></section>;}
