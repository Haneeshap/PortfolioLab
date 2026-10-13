import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();

    const response = await fetch(
      "http://127.0.0.1:8080/api/fx/attribution",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body,
        cache: "no-store",
      }
    );

    return new NextResponse(await response.text(), {
      status: response.status,
      headers: {
        "Content-Type":
          response.headers.get("content-type") ??
          "application/json",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "FX analytics backend is unavailable" },
      { status: 502 }
    );
  }
}