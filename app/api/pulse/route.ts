import { NextRequest, NextResponse } from "next/server";
import { createDataProvider } from "@/lib/providers";
import { lookupTicker, suggestTicker } from "@/lib/providers/fallback";

// Provider needs the Node.js runtime.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const symbol = (req.nextUrl.searchParams.get("symbol") || "").trim().toUpperCase();
  if (!symbol || !/^[A-Z.\-]{1,8}$/.test(symbol)) {
    return NextResponse.json({ error: "Enter a valid ticker symbol." }, { status: 400 });
  }

  // Existence check (best-effort). If SEC is reachable and it's unknown, suggest.
  let name: string | undefined;
  try {
    const info = await lookupTicker(symbol);
    if (!info) {
      const suggestion = await suggestTicker(symbol).catch(() => null);
      return NextResponse.json({ notFound: true, symbol, suggestion }, { status: 404 });
    }
    name = info.name;
  } catch {
    /* SEC unreachable — proceed without validation */
  }

  const provider = createDataProvider();
  const [qR, kR] = await Promise.allSettled([provider.getQuote(symbol), provider.getHistoricalKlines(symbol)]);
  const quote = qR.status === "fulfilled" ? qR.value : null;
  const klines = kR.status === "fulfilled" ? kR.value : null;
  const bars = klines?.bars ?? [];

  if (!quote && bars.length === 0) {
    return NextResponse.json({ error: "No price data available for this ticker.", symbol }, { status: 502 });
  }

  const closes = bars.map((b) => ({ date: b.date, close: b.close })).filter((c) => Number.isFinite(c.close));
  const n = closes.length;
  const at = (i: number) => (i >= 0 && i < n ? closes[i].close : null);
  const last = quote?.price ?? at(n - 1);
  const prev = at(n - 2);
  const chg = (from: number | null) => (from != null && last != null && from !== 0 ? (last / from - 1) * 100 : null);
  const win = closes.slice(-252).map((c) => c.close);

  return NextResponse.json({
    ok: true,
    symbol,
    name,
    price: last,
    asOf: quote?.asOf ?? closes[n - 1]?.date ?? null,
    currency: quote?.currency ?? "USD",
    changeAbs: last != null && prev != null ? last - prev : null,
    changePct: chg(prev),
    change5dPct: chg(at(n - 6)),
    change30dPct: chg(at(n - 22)),
    low52: win.length ? Math.min(...win) : null,
    high52: win.length ? Math.max(...win) : null,
    history: closes.slice(-180),
    spark: closes.slice(-32).map((c) => c.close),
  });
}