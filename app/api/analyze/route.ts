import { NextRequest, NextResponse } from "next/server";
import { analyzeTradeIdea } from "@/lib/analysis/analyze";
import { toErrorPayload } from "@/lib/analysis/errors";

// Qwen client + MCP SDK need the Node.js runtime (not Edge).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let idea = "";
  try {
    idea = (await req.json())?.idea ?? "";
  } catch {
    /* invalid body */
  }
  if (!idea.trim()) {
    return NextResponse.json(
      { error: { code: "TICKER_NOT_FOUND", tone: "amber", title: "Enter a trade idea", body: "Describe an idea with a ticker and a direction to analyze." } },
      { status: 400 },
    );
  }

  try {
    const result = await analyzeTradeIdea(idea.trim());
    return NextResponse.json(result);
  } catch (e) {
    const payload = toErrorPayload(e);
    const status = payload.code === "QWEN_KEY_MISSING" ? 503 : payload.code === "TICKER_NOT_FOUND" ? 422 : 502;
    return NextResponse.json({ error: payload }, { status });
  }
}