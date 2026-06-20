import { NextResponse } from "next/server";
import { explainRisk } from "@/services/insightAssistant";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { eventData, query } = body;

    if (!eventData || !query) {
      return NextResponse.json(
        { error: "Missing telemetry envelope or query parameter." },
        { status: 400 }
      );
    }

    const answer = await explainRisk(eventData, query);
    return NextResponse.json({ answer });
  } catch (err: unknown) {
    const error = err as Error;
    console.error("Server-side RAG API route error:", error);
    return NextResponse.json(
      { error: "Telemetry decryption matrix error: " + error.message },
      { status: 500 }
    );
  }
}
