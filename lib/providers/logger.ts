import type { ProviderName } from "./types";

/** Logs which provider served a given call — the source of truth for routing. */
export function logServed(method: string, symbol: string, via: ProviderName, note?: string) {
  console.log(`[data] ${method}(${symbol}) served via ${via}${note ? ` — ${note}` : ""}`);
}

export function logError(method: string, symbol: string, via: ProviderName, err: unknown) {
  const msg = err instanceof Error ? err.message : String(err);
  console.warn(`[data] ${method}(${symbol}) failed via ${via}: ${msg}`);
}
