import { NextRequest, NextResponse } from "next/server";
import { createDataProvider } from "@/lib/providers";

// Provider needs the Node.js runtime.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Cheap signals for the portfolio review check: current price + latest filing date. */
export async function GET(req: NextRequest) {
  const symbol = (req.nextUrl.searchParams.get("symbol") || "").trim().toUpperCase();
  if (!symbol || !/^[A-Z.\-]{1,8}$/.test(symbol)) {
    return NextResponse.json({ error: "Enter a valid ticker symbol." }, { status: 400 });
  }

  const provider = createDataProvider();
  const [qR, nR] = await Promise.allSettled([provider.getQuote(symbol), provider.getNews(symbol)]);
  const quote = qR.status === "fulfilled" ? qR.value : null;
  const news = nR.status === "fulfilled" ? nR.value : null;

  const filings = news?.items ?? [];
  const latestFilingDate = filings[0]?.publishedAt ?? null;

  return NextResponse.json({
    ok: true,
    symbol,
    price: quote?.price ?? null,
    asOf: quote?.asOf ?? null,
    latestFilingDate,
    filingCount: filings.length,
  });
}