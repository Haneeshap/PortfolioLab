import { NextRequest, NextResponse } from "next/server";

const backend = process.env.BACKEND_URL ?? "http://localhost:8080";

export async function POST(request: NextRequest) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON request" },
      { status: 400 }
    );
  }

  if (
    typeof body !== "object" ||
    body === null ||
    !("assetId" in body) ||
    !("type" in body) ||
    !("quantity" in body)
  ) {
    return NextResponse.json(
      { error: "Missing order fields" },
      { status: 400 }
    );
  }

  const { assetId, type, quantity } = body;

  if (
    !Number.isSafeInteger(assetId) ||
    typeof assetId !== "number" ||
    assetId <= 0 ||
    (type !== "BUY" && type !== "SELL") ||
    typeof quantity !== "number" ||
    !Number.isSafeInteger(quantity) ||
    quantity <= 0
  ) {
    return NextResponse.json(
      { error: "Invalid asset, order type, or quantity" },
      { status: 400 }
    );
  }

  try {
    const response = await fetch(
      `${backend}/api/portfolios/1/orders`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assetId, type, quantity }),
        cache: "no-store",
        signal: AbortSignal.timeout(10000),
      }
    );

    const result = await response.text();

    return new NextResponse(result, {
      status: response.status,
      headers: {
        "Content-Type":
          response.headers.get("content-type") ??
          "application/json",
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return NextResponse.json(
      {
        error: "Trading backend unavailable. Check transaction history before retrying.",
      },
      { status: 503 }
    );
  }
}