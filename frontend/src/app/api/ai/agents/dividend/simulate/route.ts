import { NextRequest, NextResponse } from "next/server";

const AI_SERVICE_URL = "http://127.0.0.1:3101";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body) ||
      !Number.isSafeInteger(body.eligibleShares) ||
      body.eligibleShares < 0 ||
      typeof body.dividendPerShare !== "number" ||
      !Number.isFinite(body.dividendPerShare) ||
      body.dividendPerShare < 0 ||
      !["INR", "USD", "EUR"].includes(body.currency)
    ) {
      return NextResponse.json(
        { error: "Invalid dividend simulation inputs" },
        { status: 400 }
      );
    }

    const response = await fetch(
      `${AI_SERVICE_URL}/api/agents/dividend/simulate`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          eligibleShares: body.eligibleShares,
          dividendPerShare: body.dividendPerShare,
          currency: body.currency
        }),
        signal: AbortSignal.timeout(15000),
        cache: "no-store"
      }
    );

    if (!response.ok) {
      return NextResponse.json(
        { error: "Dividend simulation service failed" },
        { status: 502 }
      );
    }

    const data = await response.json();

    if (
      data?.agent !== "dividend" ||
      data?.mode !== "read-only" ||
      !data?.simulation ||
      typeof data.simulation.grossDividend !== "number"
    ) {
      throw new Error("Unexpected dividend simulation response");
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Dividend proxy error:", error);

    return NextResponse.json(
      { error: "Unable to connect to the Dividend Agent" },
      { status: 502 }
    );
  }
}