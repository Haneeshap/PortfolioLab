

const backend = process.env.BACKEND_URL ?? "http://localhost:8080";

export async function PATCH(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

  if (!/^\d+$/.test(id)) {
    return Response.json(
      { error: "Invalid notification ID" },
      { status: 400 }
    );
  }

  try {
    const response = await fetch(
      `${backend}/api/portfolios/1/notifications/${id}/unread`,
      { method: "PATCH", cache: "no-store" }
    );

    if (!response.ok) {
      return Response.json(
        { error: "Unable to mark notification as read" },
        { status: response.status }
      );
    }

    if (response.status === 204) {
      return new Response(null, { status: 204 });
    }

    const body = await response.text();

    return new Response(body || null, {
      status: response.status,
      headers: body
        ? { "Content-Type": response.headers.get("content-type") ?? "application/json" }
        : undefined,
    });
  } catch {
    return Response.json(
      { error: "Notification service unavailable" },
      { status: 503 }
    );
  }
}