import { NextResponse } from "next/server";

export async function GET() {
  try {
    const response = await fetch(
      "http://localhost:8080/api/market/prices",
      { cache: "no-store" }
    );

    if (!response.ok) {
      return NextResponse.json(
        { error: "Market backend unavailable" },
        { status: 502 }
      );
    }

    const data = await response.json();

    return NextResponse.json(data, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json(
      { error: "Unable to connect to market backend" },
      { status: 503 }
    );
  }
}