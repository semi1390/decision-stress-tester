import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type {
  StockDataProvider,
  Quote,
  Earnings,
  Estimates,
  News,
  Klines,
  ProviderName,
} from "./types";

/**
 * BitgetProvider — connects to `bitget-mcp-server` (US stocks / ETF read-only
 * data) over MCP Streamable HTTP at https://agent.bitget.com/mcp. No API key.
 *
 * IMPORTANT: the handbook documents data *categories*, not exact tool names.
 * So this provider DISCOVERS the tool list at connect time (`listTools`) and
 * matches each method to a tool by name pattern. Run `npm run probe` to print
 * the real names + schemas, then tighten the patterns and the normalization
 * (the `normalize*` sections) to the actual fields.
 */

export interface McpToolInfo {
  name: string;
  description?: string;
  inputSchema?: { properties?: Record<string, unknown> };
}

const DEFAULT_URL = process.env.BITGET_MCP_URL ?? "https://agent.bitget.com/mcp";

// Locate the right tool from whatever the server exposes.
const TOOL_PATTERNS = {
  quote: /quote|price|ticker|realtime|snapshot/i,
  earnings: /earning/i,
  estimates: /estimate|consensus|analyst|forecast|target/i,
  news: /news|headline/i,
  klines: /kline|candle|ohlc|histor|bars?/i,
} as const;

type ToolKind = keyof typeof TOOL_PATTERNS;

export class BitgetProvider implements StockDataProvider {
  readonly name: ProviderName = "bitget";
  private client: Client | null = null;
  private tools: McpToolInfo[] = [];
  private connected = false;

  constructor(private url: string = DEFAULT_URL) {}

  /** Connect + discover tools. Throws if the endpoint is unreachable. */
  async connect(): Promise<void> {
    if (this.connected) return;
    const transport = new StreamableHTTPClientTransport(new URL(this.url));
    const client = new Client({ name: "decision-stress-tester", version: "0.1.0" });
    await client.connect(transport);
    const res = await client.listTools();
    this.client = client;
    this.tools = (res.tools ?? []) as McpToolInfo[];
    this.connected = true;
  }

  /** Discovered tool list (names + schemas). Used by the probe. */
  async listTools(): Promise<McpToolInfo[]> {
    if (!this.connected) await this.connect();
    return this.tools;
  }

  private findTool(kind: ToolKind): McpToolInfo | undefined {
    return this.tools.find((t) => TOOL_PATTERNS[kind].test(t.name));
  }

  private async call(
    tool: McpToolInfo,
    symbol: string,
    extra: Record<string, unknown> = {},
  ): Promise<unknown> {
    if (!this.client) throw new Error("not connected");
    // The server may name the symbol arg differently — try the common ones.
    const props = tool.inputSchema?.properties ?? {};
    const symbolKey =
      ["symbol", "ticker", "sym", "code", "stock"].find((k) => k in props) ?? "symbol";
    const args: Record<string, unknown> = { [symbolKey]: symbol, ...extra };
    const result = await this.client.callTool({ name: tool.name, arguments: args });
    return parseToolResult(result);
  }

  async getQuote(symbol: string): Promise<Quote> {
    if (!this.connected) await this.connect();
    const tool = this.findTool("quote");
    if (!tool) throw new Error("no quote-like tool exposed by bitget-mcp-server");
    const raw = await this.call(tool, symbol);
    return {
      symbol,
      price: pickNumber(raw, ["price", "last", "lastPrice", "close", "c"]),
      currency: pickString(raw, ["currency", "ccy"]) ?? "USD",
      asOf: pickString(raw, ["timestamp", "time", "asOf", "t"]) ?? new Date().toISOString(),
      raw,
    };
  }

  async getEarnings(symbol: string): Promise<Earnings> {
    if (!this.connected) await this.connect();
    const tool = this.findTool("earnings");
    if (!tool) throw new Error("no earnings-like tool exposed by bitget-mcp-server");
    const raw = await this.call(tool, symbol);
    // TODO: map `raw` into history[] once the probe reveals the real shape.
    return { symbol, history: [], raw };
  }

  async getEstimates(symbol: string): Promise<Estimates> {
    if (!this.connected) await this.connect();
    const tool = this.findTool("estimates");
    if (!tool) throw new Error("no estimates-like tool exposed by bitget-mcp-server");
    const raw = await this.call(tool, symbol);
    return {
      symbol,
      forwardEps: pickNumber(raw, ["forwardEps", "epsEstimate", "forwardEPS"]),
      forwardPe: pickNumber(raw, ["forwardPe", "forwardPE"]),
      forwardRevenue: pickNumber(raw, ["forwardRevenue", "revenueEstimate"]),
      targetPriceMean: pickNumber(raw, ["targetMean", "priceTargetMean", "target"]),
      analystCount: pickNumber(raw, ["analystCount", "numberOfAnalysts"]),
      consensusRating: pickString(raw, ["consensus", "rating", "recommendation"]),
      raw,
    };
  }

  async getNews(symbol: string): Promise<News> {
    if (!this.connected) await this.connect();
    const tool = this.findTool("news");
    if (!tool) throw new Error("no news-like tool exposed by bitget-mcp-server");
    const raw = await this.call(tool, symbol);
    // TODO: map `raw` into items[] once the probe reveals the real shape.
    return { symbol, items: [], raw };
  }

  async getHistoricalKlines(symbol: string, interval = "1d"): Promise<Klines> {
    if (!this.connected) await this.connect();
    const tool = this.findTool("klines");
    if (!tool) throw new Error("no klines-like tool exposed by bitget-mcp-server");
    // Pass several common arg spellings; unknown ones are typically ignored.
    const raw = await this.call(tool, symbol, {
      interval,
      period: interval,
      granularity: interval,
    });
    // TODO: map `raw` into bars[] once the probe reveals the real shape.
    return { symbol, interval, bars: [], raw };
  }

  async close(): Promise<void> {
    if (this.client) await this.client.close().catch(() => {});
    this.connected = false;
    this.client = null;
  }
}

// ── helpers ───────────────────────────────────────────────────────────────

/** MCP tool results arrive as content blocks; prefer structured JSON. */
function parseToolResult(result: any): unknown {
  if (result?.structuredContent) return result.structuredContent;
  const content = result?.content;
  if (Array.isArray(content)) {
    for (const block of content) {
      if (block?.type === "text" && typeof block.text === "string") {
        try {
          return JSON.parse(block.text);
        } catch {
          /* not JSON — fall through */
        }
      }
    }
    const text = content
      .filter((b: any) => b?.type === "text")
      .map((b: any) => b.text)
      .join("\n");
    return text || content;
  }
  return result;
}

function deepFind(obj: any, keys: string[], depth = 2): unknown {
  if (obj == null || typeof obj !== "object") return undefined;
  for (const k of keys) if (k in obj) return (obj as any)[k];
  if (depth <= 0) return undefined;
  for (const v of Object.values(obj)) {
    const r = deepFind(v, keys, depth - 1);
    if (r !== undefined) return r;
  }
  return undefined;
}

function pickNumber(obj: unknown, keys: string[]): number | null {
  const found = deepFind(obj, keys);
  const n = typeof found === "string" ? parseFloat(found) : found;
  return typeof n === "number" && !Number.isNaN(n) ? n : null;
}

function pickString(obj: unknown, keys: string[]): string | null {
  const found = deepFind(obj, keys);
  if (typeof found === "string") return found;
  if (typeof found === "number") return String(found);
  return null;
}
