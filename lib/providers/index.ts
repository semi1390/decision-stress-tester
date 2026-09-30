import type {
  StockDataProvider,
  ProviderName,
  Quote,
  Klines,
} from "./types";
import { BitgetProvider } from "./bitget";
import { FallbackProvider } from "./fallback";
import { logServed, logError } from "./logger";

export * from "./types";
export { BitgetProvider } from "./bitget";
export { FallbackProvider } from "./fallback";

/**
 * Content validators. These catch BAD DATA (not just network errors) so a
 * NaN quote or an empty/garbage bar set from EITHER provider is rejected and
 * routed to the fallback — or surfaced as a loud error if the fallback is bad
 * too. They never let silent garbage propagate downstream.
 */
function assertValidQuote(q: Quote): void {
  if (typeof q.price !== "number" || !Number.isFinite(q.price) || q.price <= 0) {
    throw new Error(`invalid quote content: price=${JSON.stringify(q.price)}`);
  }
}

function assertValidKlines(k: Klines): void {
  if (!k.bars?.length) throw new Error("invalid klines content: no bars");
  if (!k.bars.every((b) => Number.isFinite(b.close))) {
    throw new Error("invalid klines content: non-finite close");
  }
}

/**
 * Resilient provider: prefers Bitget MCP, falls back to keyless public sources.
 *
 * - Bitget connection is attempted once and memoized.
 * - If the connection fails, EVERY call uses the fallback.
 * - If the connection succeeds but an individual call throws, THAT call falls
 *   back transparently.
 * - Each call logs which provider actually served it.
 *
 * `name` here is nominal ("bitget" = intended primary). The per-call log lines
 * are the source of truth for what actually served a request.
 */
export class ResilientProvider implements StockDataProvider {
  readonly name: ProviderName = "bitget";
  private bitget = new BitgetProvider();
  private fallback = new FallbackProvider();
  private bitgetReady: Promise<boolean> | null = null;

  private ensureBitget(): Promise<boolean> {
    if (!this.bitgetReady) {
      this.bitgetReady = this.bitget
        .connect()
        .then(() => {
          console.log("[data] Bitget MCP connected — using it as primary.");
          return true;
        })
        .catch((err) => {
          const msg = err instanceof Error ? err.message : String(err);
          console.warn(`[data] Bitget MCP unavailable — fallback for all calls: ${msg}`);
          return false;
        });
    }
    return this.bitgetReady;
  }

  private async route<T>(
    method: string,
    symbol: string,
    primary: () => Promise<T>,
    secondary: () => Promise<T>,
    validate?: (out: T) => void,
  ): Promise<T> {
    const ok = await this.ensureBitget();
    if (ok) {
      try {
        const out = await primary();
        if (validate) validate(out); // bad content from Bitget => fall through
        logServed(method, symbol, "bitget");
        return out;
      } catch (err) {
        logError(method, symbol, "bitget", err);
      }
    }
    const out = await secondary();
    if (validate) validate(out); // bad content from fallback => throw loudly
    logServed(method, symbol, "fallback");
    return out;
  }

  getQuote(s: string) {
    return this.route(
      "getQuote",
      s,
      () => this.bitget.getQuote(s),
      () => this.fallback.getQuote(s),
      assertValidQuote,
    );
  }
  getEarnings(s: string) {
    return this.route("getEarnings", s, () => this.bitget.getEarnings(s), () => this.fallback.getEarnings(s));
  }
  getEstimates(s: string) {
    return this.route("getEstimates", s, () => this.bitget.getEstimates(s), () => this.fallback.getEstimates(s));
  }
  getNews(s: string) {
    return this.route("getNews", s, () => this.bitget.getNews(s), () => this.fallback.getNews(s));
  }
  getHistoricalKlines(s: string, interval?: string) {
    return this.route(
      "getHistoricalKlines",
      s,
      () => this.bitget.getHistoricalKlines(s, interval),
      () => this.fallback.getHistoricalKlines(s, interval),
      assertValidKlines,
    );
  }
}

let singleton: ResilientProvider | null = null;

/** Get the shared data provider. Product code should call ONLY this. */
export function createDataProvider(): StockDataProvider {
  if (!singleton) singleton = new ResilientProvider();
  return singleton;
}