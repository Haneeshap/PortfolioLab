export async function GET(request: Request) {
  const period = new URL(request.url).searchParams.get("period") ?? "1M";
  if (!["7D", "1M", "3M", "ALL"].includes(period)) return Response.json({ error: "Invalid period" }, { status: 400 });
  try {
    const response = await fetch(`${process.env.BACKEND_URL ?? "http://127.0.0.1:8080"}/api/portfolios/1/performance?period=${period}`, {
      cache: "no-store", signal: AbortSignal.any([request.signal, AbortSignal.timeout(30000)]),
    });
    if (!response.ok) return Response.json({ error: "Portfolio analytics unavailable" }, { status: response.status });
    return Response.json(await response.json(), { headers: { "Cache-Control": "no-store" } });
  } catch { return Response.json({ error: "Portfolio analytics unavailable; check backend and simulator" }, { status: 503 }); }
}

export async function POST(request: Request) {
  let body;
  try {
    body = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("Invalid targets");
  } catch { return Response.json({ error: "A JSON target allocation object is required." }, { status: 400 }); }
  try {
    const response = await fetch(`${process.env.BACKEND_URL ?? "http://127.0.0.1:8080"}/api/portfolios/1/rebalance/preview`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ assets: body.assets, cashPct: body.cashPct }),
      cache: "no-store", signal: AbortSignal.any([request.signal, AbortSignal.timeout(30000)]),
    });
    if (!response.ok) return Response.json({ error: response.status === 400 ? "Targets must total 100%, use valid assets and at most four decimal places." : "Plan unavailable; check current simulator quotes and portfolio limits." }, { status: response.status });
    return Response.json(await response.json(), { headers: { "Cache-Control": "no-store" } });
  } catch { return Response.json({ error: "Planner unavailable; check backend and simulator" }, { status: 503 }); }
}
