import { NextResponse } from "next/server";
const backend = process.env.BACKEND_URL ?? "http://localhost:8080";
export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!/^\d+$/.test(id)) return NextResponse.json({ error: "Invalid alert ID" }, { status: 400 });
  try {
    const response = await fetch(`${backend}/api/portfolios/1/price-alerts/${id}`, { method: "DELETE", cache: "no-store" });
    if (response.status === 204) return new Response(null, { status: 204 });
    return NextResponse.json({ error: "Unable to cancel alert" }, { status: response.status });
  } catch { return NextResponse.json({ error: "Alert service unavailable" }, { status: 503 }); }
}
