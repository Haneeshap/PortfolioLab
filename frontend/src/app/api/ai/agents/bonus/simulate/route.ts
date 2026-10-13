import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const { existingShares, bonusShares, requiredShares } = body ?? {};

    if (
      !Number.isSafeInteger(existingShares) ||
      !Number.isSafeInteger(bonusShares) ||
      !Number.isSafeInteger(requiredShares) ||
      existingShares < 0 ||
      bonusShares <= 0 ||
      requiredShares <= 0
    ) {
      return NextResponse.json(
        { error: "Enter valid whole-number share quantities and a positive bonus ratio." },
        { status: 400 }
      );
    }

    const response = await fetch(
      "http://127.0.0.1:3101/api/agents/bonus/simulate",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          existingShares,
          bonusShares,
          requiredShares
        }),
        cache: "no-store",
        signal: AbortSignal.timeout(15000)
      }
    );

    const data = await response.json();

    return NextResponse.json(data, {
      status: response.status
    });
  } catch {
    return NextResponse.json(
      { error: "Bonus simulation is unavailable. Check that the AI service and backend are running." },
      { status: 502 }
    );
  }
}