
import { NextResponse } from "next/server";


export async function GET() {
  try {
    const response = await fetch(
      "http://127.0.0.1:8080/api/market/prices",
      {
        cache: "no-store",
        signal: AbortSignal.timeout(4000),
      }
    );

    if (!response.ok) {
      return NextResponse.json(
        { error: "Market prices unavailable" },
        { status: 503 }
      );
    }

    const prices = await response.json();

    return NextResponse.json(prices);
  } catch {
    return NextResponse.json(
      { error: "Unable to reach market service" },
      { status: 503 }
    );
  }
}
