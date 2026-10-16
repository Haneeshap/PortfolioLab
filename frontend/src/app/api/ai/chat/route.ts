
import { NextRequest, NextResponse } from "next/server";

const AI_SERVICE_URL = "http://127.0.0.1:3101";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (
      typeof body?.message !== "string" ||
      !body.message.trim() ||
      body.message.length > 2000 ||
      (body.researchContext !== undefined && (body.portfolioId !== 1 || typeof body.researchContext !== "object" || body.researchContext === null || JSON.stringify(body.researchContext).length > 4096)) ||
      !Number.isSafeInteger(body.portfolioId) ||
      body.portfolioId <= 0
    ) {
      return NextResponse.json(
        { error: "Invalid chat request" },
        { status: 400 }
      );
    }

    const response = await fetch(
      `${AI_SERVICE_URL}/api/portfolio/chat`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          portfolioId: body.portfolioId,
          message: body.message,
          researchContext: body.researchContext
        }),
        signal: AbortSignal.timeout(120000),
        cache: "no-store"
      }
    );

    if (!response.ok) {
      console.error(
        "PortfolioLab AI returned HTTP",
        response.status
      );

      return NextResponse.json(
        { error: "PortfolioLab AI request failed" },
        { status: 502 }
      );
    }

    const data = await response.json();

    return NextResponse.json({
      reply: data.reply,
      model: data.model,
      holdingsCount: data.holdingsCount
    });
  } catch (error) {
    console.error("AI proxy error:", error);

    return NextResponse.json(
      { error: "Unable to connect to PortfolioLab AI" },
      { status: 502 }
    );
  }
}
