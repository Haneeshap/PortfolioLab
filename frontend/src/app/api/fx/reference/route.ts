import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;

  const from = params.get("from") ?? "USD";
  const to = params.get("to") ?? "INR";
  const date = params.get("date");

  const query = new URLSearchParams({ from, to });

  if (date) {
    query.set("date", date);
  }

  try {
    const response = await fetch(
      `http://127.0.0.1:8080/api/fx/reference?${query.toString()}`,
      { cache: "no-store" }
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
      { error: "Exchange rate service unavailable" },
      { status: 502 }
    );
  }
}