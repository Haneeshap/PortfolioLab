import { NextRequest, NextResponse } from "next/server";
export async function GET(request: NextRequest) {
  const upstream = process.env.BACKEND_URL ?? process.env.BACKEND_API_URL ?? "http://127.0.0.1:8080";
  const target = new URL("/api/market/intelligence", upstream);
  const params = request.nextUrl.searchParams;
  target.searchParams.set("portfolioId", params.get("portfolioId") ?? "1");
  target.searchParams.set("scope", params.get("scope") ?? "all");
  target.searchParams.set("type", params.get("type") ?? "all");
  target.searchParams.set("limit", "60");
  try {
    const response = await fetch(target, { cache: "no-store" });
    const text = await response.text();
    return new NextResponse(text, { status: response.status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Spring Boot backend unavailable" }, { status: 503 });
  }
}

