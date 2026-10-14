import { NextResponse } from "next/server";

const backend = process.env.BACKEND_URL ?? "http://localhost:8080";

export async function GET() {
  try {
    const response = await fetch(
      `${backend}/api/portfolios/1/notifications/unread-count`,
      { cache: "no-store" }
    );

    if (!response.ok) {
      return NextResponse.json(
        { error: "Unable to retrieve unread count" },
        { status: response.status }
      );
    }

    return NextResponse.json(await response.json(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json(
      { error: "Notification service unavailable" },
      { status: 503 }
    );
  }
}