import type { BaseRateResult, HorizonStat, Confidence } from "./baseRate";

/**
 * Stress-test logic: given the user's direction and the historical distribution,
 * produce the "what could go wrong" view. Every claim is grounded in the
 * computed counts — never vibes. If the sample is too small, we say so instead
 * of emitting a misleading stat (the same discipline as the no-fake-beat/miss rule).
 */

export interface RiskFlag {
  label: string;
  detail: string;
  severity: "info" | "caution" | "warn";
}

export interface StressTest {
  direction: "long" | "short" | "unclear";
  primaryHorizon: number;
  sampleSize: number;
  confidence: Confidence;
  sufficient: boolean;
  /** Base rate that the idea "works" over the primary horizon (%), or null. */
  baseRatePct: number | null;
  favorableLabel: string; // e.g. "continued higher"
  distribution: {
    meanReturnPct: number;
    medianReturnPct: number;
    bestPct: number;
    worstPct: number;
  } | null;
  perHorizon: {
    horizonDays: number;
    n: number;
    baseRatePct: number | null;
    meanReturnPct: number;
    medianReturnPct: number;
    worstPct: number;
    bestPct: number;
  }[];
  riskFlags: RiskFlag[];
  summary: string; // deterministic one-liner (not LLM)
}

const pct = (n: number, dp = 1) => `${n >= 0 ? "+" : ""}${n.toFixed(dp)}%`;

function favorableCount(stat: HorizonStat, direction: string): number {
  // long / unclear: up is favorable; short: down is favorable.
  return direction === "short" ? stat.downCount : stat.upCount;
}

export function buildStressTest(
  base: BaseRateResult,
  direction: "long" | "short" | "unclear",
): StressTest {
  const primary =
    base.horizons.find((h) => h.horizonDays === base.primaryHorizon) ?? base.horizons[0];
  const H = primary?.horizonDays ?? base.primaryHorizon;
  const n = primary?.n ?? 0;
  const sufficient = n >= 4; // hard floor: below this we do not assert a base rate

  const favorableLabel =
    direction === "short" ? "fell further" : direction === "unclear" ? "closed higher" : "continued higher";

  const perHorizon = base.horizons.map((h) => ({
    horizonDays: h.horizonDays,
    n: h.n,
    baseRatePct: h.n ? (favorableCount(h, direction) / h.n) * 100 : null,
    meanReturnPct: h.meanReturnPct,
    medianReturnPct: h.medianReturnPct,
    worstPct: h.worstPct,
    bestPct: h.bestPct,
  }));

  const riskFlags: RiskFlag[] = [];

  if (!sufficient) {
    riskFlags.push({
      label: "Insufficient history",
      detail: `Only ${n} usable past earnings event(s) with ${H}-day forward data — too few to assert a reliable base rate.`,
      severity: "warn",
    });
    return {
      direction,
      primaryHorizon: H,
      sampleSize: n,
      confidence: base.confidence,
      sufficient: false,
      baseRatePct: null,
      favorableLabel,
      distribution: null,
      perHorizon,
      riskFlags,
      summary: `Insufficient earnings history (n=${n}) to compute a reliable ${H}-day base rate.`,
    };
  }

  const favCount = favorableCount(primary, direction);
  const baseRatePct = (favCount / n) * 100;
  const againstCount = n - favCount;

  // 1) The base rate itself.
  riskFlags.push({
    label: "Historical base rate",
    detail: `Over the ${H} trading days after past earnings, the stock ${favorableLabel} in ${favCount} of ${n} cases (${baseRatePct.toFixed(0)}%).`,
    severity: baseRatePct >= 55 ? "info" : baseRatePct <= 45 ? "warn" : "caution",
  });

  // 2) The setup went AGAINST the idea a meaningful share of the time.
  if (againstCount > 0) {
    riskFlags.push({
      label: "It has faded before",
      detail: `The move went against a ${direction === "short" ? "short" : "long"} in ${againstCount} of ${n} past events.`,
      severity: againstCount >= n / 2 ? "warn" : "caution",
    });
  }

  // 3) Worst historical outcome.
  riskFlags.push({
    label: "Worst historical case",
    detail: `The worst ${H}-day move after earnings was ${pct(primary.worstPct)}; median was ${pct(primary.medianReturnPct)}.`,
    severity: primary.worstPct <= -10 ? "warn" : "caution",
  });

  // 4) "Pop already ran" — relevant to buying the post-earnings pop.
  if (base.pop && direction !== "short" && base.pop.popPct > 0) {
    riskFlags.push({
      label: "Move may be priced in",
      detail: `Already ${pct(base.pop.popPct)} since the close before the latest report (${base.pop.preEarningsDate}) — part of the "pop" may already be behind you.`,
      severity: base.pop.popPct >= 15 ? "warn" : "info",
    });
  }

  // 5) Low-confidence sample.
  if (base.confidence === "low") {
    riskFlags.push({
      label: "Small sample",
      detail: `Base rate rests on only ${n} events — treat it as a weak prior, not a probability.`,
      severity: "caution",
    });
  }

  const summary =
    `Over ${H} trading days after past earnings, ${favorableLabel} ${favCount}/${n} times ` +
    `(${baseRatePct.toFixed(0)}%); median ${pct(primary.medianReturnPct)}, worst ${pct(primary.worstPct)}.`;

  return {
    direction,
    primaryHorizon: H,
    sampleSize: n,
    confidence: base.confidence,
    sufficient: true,
    baseRatePct,
    favorableLabel,
    distribution: {
      meanReturnPct: primary.meanReturnPct,
      medianReturnPct: primary.medianReturnPct,
      bestPct: primary.bestPct,
      worstPct: primary.worstPct,
    },
    perHorizon,
    riskFlags,
    summary,
  };
}