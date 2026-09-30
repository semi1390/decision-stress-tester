import { createDataProvider } from "@/lib/providers";
import { lookupTicker, suggestTicker } from "@/lib/providers/fallback";
import { qwenText, qwenMeta, qwenConfigured } from "@/lib/llm/qwen";
import { extractTradeIdea } from "./extract";
import { computeEarningsBaseRate, type BaseRateResult } from "./baseRate";
import { buildStressTest, type StressTest } from "./stressTest";
import { AnalysisError } from "./errors";
import { buildIntelligence, type Intelligence } from "./intelligence";

export interface EarningsSummary {
  fiscalPeriod?: string;
  reportDate?: string;
  epsActual?: number | null;
  epsEstimate?: number | null;
  surprisePct?: number | null;
  beatMiss?: "beat" | "miss" | "inline" | null;
  consensusAvailable: boolean;
}

export interface AnalysisResult {
  idea: string;
  ticker: string;
  companyName?: string;
  direction: "long" | "short" | "unclear";
  thesis: string;
  setupLabel: string; // e.g. "after an earnings beat" / "after past earnings"
  quote: { price: number | null; asOf?: string; currency?: string } | null;
  earnings: { latest: EarningsSummary | null; historyCount: number };
  estimates: {
    available: boolean;
    forwardEps?: number | null;
    forwardPe?: number | null;
    targetPriceMean?: number | null;
    consensusRating?: string | null;
  };
  news: { items: { title: string; url?: string; source?: string; publishedAt?: string; summary?: string; formType?: string }[] };
  takeaway: string; // plain-English "what actually happened" (Qwen)
  historical: {
    eventsProvided: number;
    eventsUsable: number;
    eventDatesUsed: string[];
    pop: BaseRateResult["pop"];
  };
  stress: StressTest; // grounded base-rate distribution + risk flags
  stressBrief: string; // Qwen: clear-eyed brief that challenges the trade
  intelligence: Intelligence | null; // structured 8-section AI analysis (null if LLM failed)
  dataNotes: string[]; // explicit limitations
  meta: { model: string };
}

const SYNTH_SYSTEM = `You are a financial research assistant. Using ONLY the JSON data provided, write a plain-English readout of "what actually happened" for this stock: the real signal from the latest earnings and recent news.

Strict rules:
- Be factual and neutral. This is NOT trade advice — do not tell the user to buy, sell, hold, or size a position.
- Do NOT invent numbers, estimates, consensus figures, or a beat/miss. If "consensusAvailable" is false, state that results are the company's reported figures only and that no consensus comparison is available.
- If a field is null/missing, say it's unavailable rather than guessing.
- Summarize the recent news/filings at a high level; do not fabricate headlines.
- 2 to 4 short paragraphs. No headings, no bullet lists, no disclaimers beyond the data-limitation note.`;

const STRESS_SYSTEM = `You are a disciplined trading-desk research assistant. Using ONLY the JSON provided, write a clear-eyed research brief that STRESS-TESTS the user's trade idea. Challenge it — do not cheerlead.

Cover, in 2 to 4 short paragraphs:
- The setup: what the user wants to do, and what the latest earnings actually showed.
- The historical base rate: cite the ACTUAL numbers provided (how often it worked, over how many trading days, the sample size and confidence).
- What could go wrong: the downside, worst historical case, and fade rate straight from the numbers; plus whether the move may already be priced in.
- A disciplined bottom line that helps the human decide.

Strict rules:
- NEVER give a buy / sell / hold command or a position size. Inform the decision; do not make it.
- Ground EVERY quantitative claim in the provided numbers. Do not invent statistics.
- If "sufficient" is false or confidence is "low"/"insufficient", say plainly that the base rate is weak / low-confidence and lean toward caution.
- It is fine — expected — to push back on the idea when the data warrants.
- No headings, no bullet lists.`;

export async function analyzeTradeIdea(idea: string): Promise<AnalysisResult> {
  if (!qwenConfigured()) {
    throw new AnalysisError("QWEN_KEY_MISSING");
  }

  let extracted;
  try {
    extracted = await extractTradeIdea(idea);
  } catch {
    throw new AnalysisError("UPSTREAM_ERROR");
  }
  if (!extracted.ticker) {
    throw new AnalysisError("TICKER_NOT_FOUND");
  }
  const ticker = extracted.ticker;

  // Validate the ticker exists (best-effort). If SEC is reachable and the
  // symbol isn't real, offer a "did you mean"; if SEC is unreachable, skip
  // validation and proceed rather than blocking the analysis.
  let companyName: string | undefined;
  try {
    const info = await lookupTicker(ticker);
    if (info) {
      companyName = info.name;
    } else {
      const suggestion = await suggestTicker(ticker).catch(() => null);
      throw new AnalysisError("TICKER_NOT_FOUND", { ticker, suggestion });
    }
  } catch (e) {
    if (e instanceof AnalysisError) throw e;
    // SEC unreachable — proceed without validation.
  }

  const provider = createDataProvider();

  const [quoteR, earningsR, estimatesR, newsR, klinesR] = await Promise.allSettled([
    provider.getQuote(ticker),
    provider.getEarnings(ticker),
    provider.getEstimates(ticker),
    provider.getNews(ticker),
    provider.getHistoricalKlines(ticker),
  ]);

  const quote = quoteR.status === "fulfilled" ? quoteR.value : null;
  const earnings = earningsR.status === "fulfilled" ? earningsR.value : null;
  const estimates = estimatesR.status === "fulfilled" ? estimatesR.value : null;
  const news = newsR.status === "fulfilled" ? newsR.value : null;
  const klines = klinesR.status === "fulfilled" ? klinesR.value : null;

  // If every core source failed, surface a clean service error.
  if (!quote && !earnings && !klines) {
    throw new AnalysisError("UPSTREAM_ERROR");
  }
  companyName = companyName ?? earnings?.companyName;

  // ── Latest earnings + beat/miss (ONLY if a consensus estimate is present) ──
  const latestRep = earnings?.history?.[0] ?? null;
  let latest: EarningsSummary | null = null;
  if (latestRep) {
    const hasConsensus =
      latestRep.epsEstimate != null && latestRep.epsActual != null;
    let beatMiss: EarningsSummary["beatMiss"] = null;
    let surprisePct = latestRep.surprisePct ?? null;
    if (hasConsensus) {
      const a = latestRep.epsActual as number;
      const e = latestRep.epsEstimate as number;
      if (surprisePct == null && e !== 0) surprisePct = ((a - e) / Math.abs(e)) * 100;
      beatMiss = a > e ? "beat" : a < e ? "miss" : "inline";
    }
    latest = {
      fiscalPeriod: latestRep.fiscalPeriod,
      reportDate: latestRep.reportDate,
      epsActual: latestRep.epsActual ?? null,
      epsEstimate: latestRep.epsEstimate ?? null,
      surprisePct,
      beatMiss,
      consensusAvailable: hasConsensus,
    };
  }

  const estAvailable = !!(
    estimates &&
    (estimates.forwardEps != null ||
      estimates.forwardPe != null ||
      estimates.targetPriceMean != null ||
      estimates.consensusRating != null)
  );

  // ── Explicit data-limitation notes (never hidden) ──
  const dataNotes: string[] = [];
  if (!latest) {
    dataNotes.push("No recent earnings report found in the current data source.");
  } else if (!latest.consensusAvailable) {
    dataNotes.push(
      "Consensus estimates unavailable for the reported quarter — showing reported results only; no beat/miss computed.",
    );
  }
  if (!estAvailable) {
    dataNotes.push("Forward analyst estimates unavailable from the current source (pending Bitget).");
  }
  if (!news || news.items.length === 0) {
    dataNotes.push("No recent filings/news found for this ticker.");
  }

  // ── Historical-analog base rate (from clean closes; does not need Bitget) ──
  const eventDates = (earnings?.history ?? [])
    .map((h) => h.reportDate)
    .filter((d): d is string => typeof d === "string" && d.length >= 10);

  const baseRate = computeEarningsBaseRate(klines?.bars ?? [], eventDates);
  const stress = buildStressTest(baseRate, extracted.direction);

  if (eventDates.length > 0) {
    dataNotes.push("Earnings event dates use SEC filing dates as a proxy for the report date.");
  }
  if (!stress.sufficient) {
    dataNotes.push(
      `Insufficient earnings history for a reliable base rate (n=${stress.sampleSize}) — the stress test flags this rather than guessing.`,
    );
  } else if (baseRate.confidence === "low") {
    dataNotes.push(
      `Base rate rests on a small sample (n=${stress.sampleSize}) — treat it as a weak prior.`,
    );
  }

  // ── Qwen synthesis: "what actually happened" ──
  const facts = {
    ticker,
    thesis: extracted.thesis,
    direction: extracted.direction,
    quote: quote ? { price: quote.price, asOf: quote.asOf } : null,
    latestEarnings: latest,
    forwardEstimates: estAvailable
      ? {
          forwardEps: estimates!.forwardEps ?? null,
          forwardPe: estimates!.forwardPe ?? null,
          targetPriceMean: estimates!.targetPriceMean ?? null,
          consensusRating: estimates!.consensusRating ?? null,
        }
      : null,
    recentNews: (news?.items ?? []).slice(0, 8).map((i) => ({
      title: i.title,
      date: i.publishedAt,
      source: i.source,
    })),
  };

  const stressFacts = {
    ticker,
    direction: extracted.direction,
    thesis: extracted.thesis,
    latestEarnings: latest,
    baseRate: {
      primaryHorizon: baseRate.primaryHorizon,
      confidence: baseRate.confidence,
      sufficient: stress.sufficient,
      sampleSize: stress.sampleSize,
      baseRatePct: stress.baseRatePct,
      favorableLabel: stress.favorableLabel,
      distribution: stress.distribution,
      perHorizon: stress.perHorizon,
      pop: baseRate.pop,
    },
    riskFlags: stress.riskFlags,
    note: "Returns are % forward moves over N trading days from the first close on/after each past earnings filing date. Base the brief only on these numbers.",
  };

  const intelFacts = {
    ticker,
    companyName,
    direction: extracted.direction,
    userThesis: extracted.thesis,
    price: quote?.price ?? null,
    latestEarnings: latest, // period, epsActual, epsEstimate, consensusAvailable, beatMiss
    recentNews: (news?.items ?? []).slice(0, 8).map((i) => ({
      title: i.title,
      summary: i.summary,
      date: i.publishedAt,
      formType: i.formType,
    })),
    // REAL engine output — the model must cite these and must not invent numbers.
    baseRate: {
      primaryHorizon: baseRate.primaryHorizon,
      confidence: baseRate.confidence,
      sufficient: stress.sufficient,
      sampleSize: stress.sampleSize,
      baseRatePct: stress.baseRatePct,
      favorableLabel: stress.favorableLabel,
      distribution: stress.distribution,
      perHorizon: stress.perHorizon,
      pop: baseRate.pop,
    },
    riskFlags: stress.riskFlags,
    dataNotes,
    note: "All statistics MUST come from baseRate/riskFlags. Do not invent numbers. If latestEarnings.consensusAvailable is false, do not claim a beat or miss.",
  };

  const [takeaway, stressBriefText, intelligence] = await Promise.all([
    qwenText(SYNTH_SYSTEM, JSON.stringify(facts)).catch(() => ""),
    qwenText(STRESS_SYSTEM, JSON.stringify(stressFacts)).catch(() => ""),
    buildIntelligence(intelFacts),
  ]);

  if (!intelligence || !takeaway) {
    console.warn(`[analyze] ${ticker}: AI output degraded — intelligence=${intelligence ? "ok" : "NULL"}, takeaway=${takeaway ? "ok" : "EMPTY"}. Check the [qwen] logs above.`);
  }

  const setupLabel =
    latest?.beatMiss === "beat"
      ? "after an earnings beat"
      : latest?.beatMiss === "miss"
        ? "after a miss"
        : "after past earnings";

  return {
    idea,
    ticker,
    companyName,
    direction: extracted.direction,
    thesis: extracted.thesis,
    setupLabel,
    quote: quote ? { price: quote.price, asOf: quote.asOf, currency: quote.currency } : null,
    earnings: { latest, historyCount: earnings?.history.length ?? 0 },
    estimates: {
      available: estAvailable,
      forwardEps: estimates?.forwardEps ?? null,
      forwardPe: estimates?.forwardPe ?? null,
      targetPriceMean: estimates?.targetPriceMean ?? null,
      consensusRating: estimates?.consensusRating ?? null,
    },
    news: {
      items: (news?.items ?? []).slice(0, 10).map((i) => ({
        title: i.title,
        url: i.url,
        source: i.source,
        publishedAt: i.publishedAt,
        summary: i.summary,
        formType: i.formType,
      })),
    },
    takeaway,
    historical: {
      eventsProvided: baseRate.eventsProvided,
      eventsUsable: baseRate.eventsUsable,
      eventDatesUsed: baseRate.eventDatesUsed,
      pop: baseRate.pop,
    },
    stress,
    stressBrief: stressBriefText,
    intelligence,
    dataNotes,
    meta: { model: qwenMeta().model },
  };
}