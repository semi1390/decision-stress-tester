/**
 * Connectivity probe — run with:  npm run probe   (optionally: npm run probe TSLA)
 *
 * ① RAW BITGET MCP PROBE
 *    Connects to the Bitget MCP endpoint, lists the REAL tool names + input
 *    schemas, and pulls sample data for NVDA (quote, earnings, estimates, news)
 *    so you can see the actual data shape on YOUR machine.
 *    If Bitget is unreachable, it prints the error and moves on.
 *
 * ② RESILIENT PROVIDER PROBE
 *    Runs the same provider your app uses (Bitget → fallback) and confirms the
 *    keyless fallback returns data even if Bitget is down. The (via bitget /
 *    via fallback) log lines show which source served each call.
 */
import { BitgetProvider } from "../lib/providers/bitget";
import { createDataProvider } from "../lib/providers/index";

const SYMBOL = process.argv[2] ?? "NVDA";
const URL = process.env.BITGET_MCP_URL ?? "https://agent.bitget.com/mcp";
const line = (s = "") => console.log(s);
const hr = () => line("─".repeat(66));

async function rawBitgetProbe() {
  hr();
  line(`① RAW BITGET MCP PROBE   ${URL}`);
  hr();

  const bitget = new BitgetProvider();
  try {
    await bitget.connect();
    const tools = await bitget.listTools();
    line(`✅ Connected. ${tools.length} tool(s) exposed:`);
    line();
    for (const t of tools) {
      const args = t.inputSchema?.properties
        ? Object.keys(t.inputSchema.properties).join(", ")
        : "—";
      line(`  • ${t.name}`);
      if (t.description) line(`      ${t.description.slice(0, 100)}`);
      line(`      args: ${args}`);
    }
    line();

    for (const method of ["getQuote", "getEarnings", "getEstimates", "getNews"] as const) {
      try {
        const out: any = await (bitget as any)[method](SYMBOL);
        line(`── ${method}(${SYMBOL}) — raw upstream payload ──`);
        line(JSON.stringify(out.raw ?? out, null, 2).slice(0, 1400));
        line();
      } catch (e) {
        line(`   ${method}(${SYMBOL}) failed: ${(e as Error).message}`);
        line();
      }
    }
    await bitget.close();
  } catch (e) {
    line(`❌ Bitget MCP unreachable: ${(e as Error).message}`);
    line("   → No problem for the demo: the resilient provider uses the keyless");
    line("     fallback instead. See the RESILIENT PROVIDER PROBE below.");
    line();
  }
}

async function resilientProbe() {
  line();
  hr();
  line("② RESILIENT PROVIDER PROBE   (Bitget → keyless fallback)");
  hr();

  const provider = createDataProvider();

  // Per-call so one failure surfaces clearly without hiding the others.
  const call = async <T>(label: string, p: Promise<T>): Promise<T | null> => {
    try {
      return await p;
    } catch (e) {
      line(`  ${label}: ERROR — ${(e as Error).message}`);
      return null;
    }
  };

  const quote = await call("quote", provider.getQuote(SYMBOL));
  const earnings = await call("earnings", provider.getEarnings(SYMBOL));
  const estimates = await call("estimates", provider.getEstimates(SYMBOL));
  const news = await call("news", provider.getNews(SYMBOL));
  const klines = await call("klines", provider.getHistoricalKlines(SYMBOL));

  line();
  line("Normalized summary:");
  line(`  quote:      ${quote ? `${quote.price} ${quote.currency ?? ""} (asOf ${quote.asOf})` : "—"}`);
  line(`  earnings:   ${earnings ? `${earnings.history.length} period(s)` : "—"}`);
  line(`  estimates:  ${estimates ? `forwardEps=${estimates.forwardEps ?? "n/a"} fwdPE=${estimates.forwardPe ?? "n/a"} (keyless: not available)` : "—"}`);
  line(`  news:       ${news ? `${news.items.length} item(s)` : "—"}`);
  line(`  klines:     ${klines ? `${klines.bars.length} bar(s) [source: ${(klines.raw as any)?.source}]` : "—"}`);
  line();
  if (earnings?.history[0]) {
    const e = earnings.history[0];
    line(`  latest earnings: ${e.fiscalPeriod} — EPS ${e.epsActual} (filed ${e.reportDate})`);
  }
  line(`  first news:      ${news?.items[0]?.title ?? "—"}`);
  const lastBar = klines?.bars[klines.bars.length - 1];
  line(`  latest bar:      ${lastBar ? JSON.stringify(lastBar) : "—"}`);
  line();

  const allGood = !!(quote && klines?.bars.length && earnings && news);
  line(
    allGood
      ? "✅ Done. Quote, klines, earnings, and news all returned valid data."
      : "⚠️  Done, but one or more methods failed — see errors above.",
  );
  line("   (served via bitget / via fallback) lines are the source of truth for routing.");
}

(async () => {
  await rawBitgetProbe();
  await resilientProbe();
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});