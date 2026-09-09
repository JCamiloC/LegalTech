import { NextResponse } from "next/server";
import { testGeminiConnection } from "@/modules/llm/gemini-client";

export const runtime = "nodejs";

export async function GET() {
  const result = await testGeminiConnection();

  return NextResponse.json(result, { status: result.ok ? 200 : 503 });
}
