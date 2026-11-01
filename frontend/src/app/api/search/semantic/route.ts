import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const upstream =
    process.env.BACKEND_URL ?? process.env.BACKEND_API_URL ?? "http://127.0.0.1:8080";
  const target = new URL("/api/search/semantic", upstream);
  const params = request.nextUrl.searchParams;
  const q = params.get("q");
  if (q) target.searchParams.set("q", q);
  target.searchParams.set("limit", params.get("limit") ?? "5");

  try {
    const response = await fetch(target, { cache: "no-store" });
    const text = await response.text();
    return new NextResponse(text, {
      status: response.status,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json(
      { error: "Spring Boot backend unavailable" },
      { status: 503 }
    );
  }
}
