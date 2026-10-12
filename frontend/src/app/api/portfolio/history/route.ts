export const instant = false;

export async function GET() {
  try {
    const response = await fetch(
      "http://127.0.0.1:8080/api/portfolios/1/history",
      { cache: "no-store" }
    );

    if (!response.ok) {
      return Response.json(
        { error: "Unable to retrieve portfolio history" },
        { status: response.status }
      );
    }

    const history = await response.json();

    return Response.json(history, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return Response.json(
      { error: "History service unavailable" },
      { status: 503 }
    );
  }
}
