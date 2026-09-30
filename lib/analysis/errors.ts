export type ErrorCode = "TICKER_NOT_FOUND" | "QWEN_KEY_MISSING" | "UPSTREAM_ERROR";

export interface ErrorPayload {
  code: ErrorCode;
  title: string;
  body: string;
  /** amber = user can fix · neutral = setup problem · red = service failed */
  tone: "amber" | "neutral" | "red";
  ticker?: string;
  suggestion?: { symbol: string; name: string } | null;
}

export class AnalysisError extends Error {
  code: ErrorCode;
  ticker?: string;
  suggestion?: { symbol: string; name: string } | null;

  constructor(code: ErrorCode, opts: { ticker?: string; suggestion?: { symbol: string; name: string } | null } = {}) {
    super(code);
    this.code = code;
    this.ticker = opts.ticker;
    this.suggestion = opts.suggestion ?? null;
  }

  toPayload(): ErrorPayload {
    switch (this.code) {
      case "TICKER_NOT_FOUND":
        return {
          code: this.code,
          tone: "amber",
          title: this.ticker ? `We couldn't find the ticker ${this.ticker}` : "We couldn't identify a ticker",
          body: "Check the symbol and try again. Nothing was analyzed, so there's no cost to retrying.",
          ticker: this.ticker,
          suggestion: this.suggestion,
        };
      case "QWEN_KEY_MISSING":
        return {
          code: this.code,
          tone: "neutral",
          title: "Analysis isn't available right now",
          body: "The analysis engine isn't configured. This one needs the site owner, not you.",
        };
      case "UPSTREAM_ERROR":
      default:
        return {
          code: "UPSTREAM_ERROR",
          tone: "red",
          title: "Something went wrong on our end",
          body: "A data source didn't respond. Your idea is kept in the box, so retrying is one click.",
        };
    }
  }
}

/** Convert any thrown value into a typed payload. */
export function toErrorPayload(err: unknown): ErrorPayload {
  if (err instanceof AnalysisError) return err.toPayload();
  return new AnalysisError("UPSTREAM_ERROR").toPayload();
}