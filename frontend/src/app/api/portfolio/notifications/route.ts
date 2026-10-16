

const backend = process.env.BACKEND_URL ?? "http://localhost:8080";

export async function GET(request: Request) {
  try {
    const response = await fetch(
      `${backend}/api/portfolios/1/notifications${new URL(request.url).search}`,
      { cache: "no-store" }
    );

    if (!response.ok) {
      return Response.json(
        { error: "Unable to retrieve notifications" },
        { status: response.status }
      );
    }

    return Response.json(await response.json(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return Response.json(
      { error: "Notification service unavailable" },
      { status: 503 }
    );
  }
}