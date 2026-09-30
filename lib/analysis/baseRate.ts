import type { Kline } from "@/lib/providers/types";

/**
 * Historical-analog base-rate engine.
 *
 * For an earnings-driven idea ("buy the post-earnings pop"), we measure what the
 * stock actually did after each PAST earnings event: the N-trading-day forward
 * return from the first close on/after the event date. All math is on CLOSES,
 * which the data layer fetches cleanly. Everything is grounded in counts — no
 * vibes — and the sample size is always reported.
 */

export interface HorizonStat {
  horizonDays: number;
  n: number; // usable events for this horizon
  upCount: number; // forward return > 0
  downCount: number; // forward return < 0
  upRatePct: number; // upCount / n * 100
  meanReturnPct: number;
  medianReturnPct: number;
  bestPct: number;
  worstPct: number;
  returnsPct: number[]; // raw per-event forward returns (%)
}

export type Confidence = "insufficient" | "low" | "moderate" | "high";

export interface BaseRateResult {
  eventsProvided: number;
  eventsUsable: number; // events with an entry bar found in the price series
  primaryHorizon: number;
  horizons: HorizonStat[];
  confidence: Confidence;
  /** How far price has already moved since just before the latest report. */
  pop: {
    preEarningsDate: string;
    preEarningsClose: number;
    currentClose: number;
    popPct: number;
  } | null;
  eventDatesUsed: string[];
}

/** First index whose bar date is >= target (bars must be ascending by date). */
function indexOnOrAfter(bars: Kline[], date: string): number {
  let lo = 0;
  let hi = bars.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (bars[mid].date >= date) {
      ans = mid;
      hi = mid - 1;
    } else {
      lo = mid + 1;
    }
  }
  return ans;
}

function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function statFor(horizonDays: number, returnsPct: number[]): HorizonStat {
  const n = returnsPct.length;
  const upCount = returnsPct.filter((r) => r > 0).length;
  const downCount = returnsPct.filter((r) => r < 0).length;
  return {
    horizonDays,
    n,
    upCount,
    downCount,
    upRatePct: n ? (upCount / n) * 100 : 0,
    meanReturnPct: n ? returnsPct.reduce((a, b) => a + b, 0) / n : 0,
    medianReturnPct: median(returnsPct),
    bestPct: n ? Math.max(...returnsPct) : 0,
    worstPct: n ? Math.min(...returnsPct) : 0,
    returnsPct,
  };
}

function confidenceFor(n: number): Confidence {
  if (n < 4) return "insufficient";
  if (n < 10) return "low";
  if (n < 20) return "moderate";
  return "high";
}

export function computeEarningsBaseRate(
  bars: Kline[],
  eventDates: string[],
  horizons: number[] = [1, 5, 20],
  primaryHorizon = 5,
): BaseRateResult {
  // Ensure ascending by date and clean of non-positive closes.
  const series = [...bars]
    .filter((b) => Number.isFinite(b.close) && b.close > 0 && /^\d{4}-\d{2}-\d{2}/.test(b.date))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  const dates = [...new Set(eventDates.filter(Boolean))].sort();
  const perH: Record<number, number[]> = {};
  horizons.forEach((h) => (perH[h] = []));
  const usedDates: string[] = [];
  let usable = 0;

  for (const d of dates) {
    const i = indexOnOrAfter(series, d);
    if (i < 0) continue;
    const entry = series[i].close;
    if (!(entry > 0)) continue;
    let counted = false;
    for (const h of horizons) {
      const j = i + h;
      if (j < series.length) {
        const r = (series[j].close / entry - 1) * 100;
        if (Number.isFinite(r)) {
          perH[h].push(r);
          counted = true;
        }
      }
    }
    if (counted) {
      usable++;
      usedDates.push(d);
    }
  }

  const horizonStats = horizons.map((h) => statFor(h, perH[h]));
  const primaryN = horizonStats.find((s) => s.horizonDays === primaryHorizon)?.n ?? 0;

  // "Pop": move from the close just before the latest event to the latest close.
  let pop: BaseRateResult["pop"] = null;
  if (dates.length && series.length) {
    const latest = dates[dates.length - 1];
    const i = indexOnOrAfter(series, latest);
    if (i > 0) {
      const preClose = series[i - 1].close;
      const current = series[series.length - 1].close;
      if (preClose > 0) {
        pop = {
          preEarningsDate: series[i - 1].date,
          preEarningsClose: preClose,
          currentClose: current,
          popPct: (current / preClose - 1) * 100,
        };
      }
    }
  }

  return {
    eventsProvided: dates.length,
    eventsUsable: usable,
    primaryHorizon,
    horizons: horizonStats,
    confidence: confidenceFor(primaryN),
    pop,
    eventDatesUsed: usedDates,
  };
}