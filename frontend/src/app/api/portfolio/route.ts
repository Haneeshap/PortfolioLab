import { NextResponse } from "next/server";

const backend = process.env.BACKEND_URL ?? "http://localhost:8080";

export async function GET() {
  try {
    const paths = [
      "/api/portfolios/1",
      "/api/portfolios/1/holdings",
      "/api/portfolios/1/transactions",
    ];

    const responses = await Promise.all(
      paths.map((path) =>
        fetch(`${backend}${path}`, { cache: "no-store" })
      )
    );

    if (responses.some((response) => !response.ok)) {
      return NextResponse.json(
        { error: "Unable to retrieve portfolio data" },
        { status: 502 }
      );
    }

    const [portfolio, holdings, transactions] =
      await Promise.all(responses.map((response) => response.json()));

    return NextResponse.json(
      { portfolio, holdings, transactions },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return NextResponse.json(
      { error: "Portfolio backend is unavailable" },
      { status: 503 }
    );
  }
}