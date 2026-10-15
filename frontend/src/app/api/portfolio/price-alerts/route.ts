import { NextResponse } from "next/server";
const backend = process.env.BACKEND_URL ?? "http://localhost:8080";
export async function GET() {
  try {
    const response = await fetch(`${backend}/api/portfolios/1/price-alerts`, { cache: "no-store" });
    return NextResponse.json(await response.json(), { status: response.status });
  } catch { return NextResponse.json({ error: "Alert service unavailable" }, { status: 503 }); }
}
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const response = await fetch(`${backend}/api/portfolios/1/price-alerts`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), cache: "no-store",
    });
    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status });
  } catch { return NextResponse.json({ error: "Unable to create alert" }, { status: 503 }); }
}
