import { NextResponse } from "next/server";
import { BitgetProvider } from "@/lib/providers/bitget";

// Throwaway diagnostic: tests whether the Bitget MCP data server is reachable
// from THIS environment (e.g. Vercel's region). Delete after verifying.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET() {
  const url = process.env.BITGET_MCP_URL ?? "https://agent.bitget.com/mcp";
  const started = Date.now();
  const bitget = new BitgetProvider();
  try {
    await bitget.connect();
    const tools = await bitget.listTools();
    await bitget.close();
    return NextResponse.json({
      reachable: true,
      url,
      ms: Date.now() - started,
      toolCount: tools.length,
      tools: tools.map((t) => ({ name: t.name, args: Object.keys(t.inputSchema?.properties ?? {}) })),
      note: "Bitget MCP is reachable from this environment — BitgetProvider will serve as the primary data source, with the keyless fallback as backup.",
    });
  } catch (e) {
    return NextResponse.json({
      reachable: false,
      url,
      ms: Date.now() - started,
      error: e instanceof Error ? e.message : String(e),
      note: "Bitget MCP is NOT reachable from this environment. The app still works fully on the keyless fallback (stockanalysis.com + Stooq + SEC EDGAR).",
    }, { status: 200 });
  }
}