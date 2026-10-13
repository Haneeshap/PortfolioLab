import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const response = await fetch(
      "http://127.0.0.1:3101/api/agents/business-rules/evaluate",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        cache: "no-store",
        signal: AbortSignal.timeout(15000)
      }
    );

    const result = await response.json();

    return NextResponse.json(result, {
      status: response.status
    });
  } catch {
    return NextResponse.json(
      { error: "Business Rules AI service is unavailable." },
      { status: 502 }
    );
  }
}