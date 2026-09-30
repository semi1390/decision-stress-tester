import { qwenJson } from "@/lib/llm/qwen";

export interface ExtractedIdea {
  ticker: string | null; // uppercase US symbol, or null if none found
  direction: "long" | "short" | "unclear";
  thesis: string; // one-sentence restatement in neutral terms
}

const SYSTEM = `You extract structured fields from a trader's plain-English trade idea about a US stock.
Rules:
- "ticker": the US stock ticker symbol in uppercase (e.g. NVDA, AAPL). If a company name is given, map it to its symbol. If no single stock is identifiable, use null.
- "direction": "long" if they want to buy/hold/go up, "short" if they want to sell/short/go down, otherwise "unclear".
- "thesis": one neutral sentence restating what they're considering. Do not add opinions or advice.
Return an object with exactly these keys: ticker, direction, thesis.`;

export async function extractTradeIdea(idea: string): Promise<ExtractedIdea> {
  const out = await qwenJson<ExtractedIdea>(SYSTEM, idea);
  const ticker =
    typeof out.ticker === "string" && /^[A-Z.]{1,6}$/.test(out.ticker.toUpperCase())
      ? out.ticker.toUpperCase()
      : null;
  const direction =
    out.direction === "long" || out.direction === "short" ? out.direction : "unclear";
  const thesis = typeof out.thesis === "string" && out.thesis.trim() ? out.thesis.trim() : idea;
  return { ticker, direction, thesis };
}