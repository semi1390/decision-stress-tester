import type { Position, SavedThesis } from "@/components/analysis-ui";

/** Cheap review thresholds. */
export const REVIEW_PRICE_DRIFT_PCT = 10;

export type ReviewSignal = {
  kind: "price_drift" | "new_filing";
  label: string;
  severity: "caution" | "warn";
};

/** Live P&L for a position given the current price (long/short aware). */
export function positionPnl(pos: Position, currentPrice: number | null): { abs: number | null; pct: number | null } {
  if (currentPrice == null || !Number.isFinite(currentPrice) || !(pos.entryPrice > 0)) return { abs: null, pct: null };
  const mul = pos.side === "short" ? -1 : 1;
  const pct = ((currentPrice - pos.entryPrice) / pos.entryPrice) * 100 * mul;
  const abs = (currentPrice - pos.entryPrice) * pos.size * mul;
  return { abs, pct };
}

/**
 * Lightweight "thesis may need review" signals — deliberately cheap:
 *  - price has drifted past a % threshold from entry, OR
 *  - a new SEC filing has appeared since the thesis was saved.
 * No semantic contradiction — that's intentionally out of scope here.
 */
export function computeReviewSignals(
  pos: Position,
  thesis: SavedThesis | null,
  currentPrice: number | null,
  latestFilingDate: string | null,
): ReviewSignal[] {
  const out: ReviewSignal[] = [];

  if (currentPrice != null && pos.entryPrice > 0) {
    const drift = ((currentPrice - pos.entryPrice) / pos.entryPrice) * 100;
    if (Math.abs(drift) >= REVIEW_PRICE_DRIFT_PCT) {
      out.push({
        kind: "price_drift",
        label: `Price has moved ${drift >= 0 ? "+" : ""}${drift.toFixed(1)}% from your entry`,
        severity: "caution",
      });
    }
  }

  if (thesis && latestFilingDate) {
    const savedNewest = thesis.news?.items?.[0]?.publishedAt ?? thesis.createdAt?.slice(0, 10);
    if (savedNewest && latestFilingDate > savedNewest) {
      out.push({
        kind: "new_filing",
        label: `New SEC filing since you saved this (${latestFilingDate})`,
        severity: "warn",
      });
    }
  }

  return out;
}