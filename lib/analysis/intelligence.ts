import { qwenJson } from "@/lib/llm/qwen";

/**
 * The structured intelligence object the UI renders as 8 distinct blocks.
 * Stress-test and confidence content is GROUNDED in the real engine numbers
 * passed in `facts` (base-rate distribution, sample size, risk flags, data
 * notes) — the model must cite them and must not fabricate statistics.
 */
export interface IntelDecision {
  call: "Trade" | "Watch" | "Pass";
  reasoning: string;
}
export interface IntelConfidence {
  rationale: string;
  unknowns: string[];
}
export interface Intelligence {
  situation: string;
  evidenceFor: string[];
  evidenceAgainst: string[];
  thesisRestated: string;
  assumptions: string[]; // atomic, standalone, machine-readable
  stressTest: string; // narrative citing the real base-rate numbers
  decision: IntelDecision;
  confidence: IntelConfidence;
}

const SYSTEM = `You are a disciplined trading-desk analyst. Your job is to CHALLENGE the user's trade idea, grounded strictly in the JSON facts provided (real earnings, recent SEC filings, the user's idea, and the REAL historical base-rate engine output). You are a skeptic, not a cheerleader.

Return STRICT JSON only, with exactly these keys:
{
  "situation": string,
  "evidenceFor": string[],
  "evidenceAgainst": string[],
  "thesisRestated": string,
  "assumptions": string[],
  "stressTest": string,
  "decision": { "call": "Trade" | "Watch" | "Pass", "reasoning": string },
  "confidence": { "rationale": string, "unknowns": string[] }
}

Hard rules:
- Ground EVERYTHING in the provided facts. NEVER invent a statistic. Every number you cite must appear verbatim in the provided baseRate or riskFlags.
- Do NOT fabricate a consensus/beat/miss. If latestEarnings.consensusAvailable is false, do not claim the company beat or missed — say results are reported figures only.
- "situation": 1–2 sentences on what actually happened, from earnings + news.
- "evidenceFor": 2–4 short bullet strings that genuinely support the user's thesis, from the facts.
- "evidenceAgainst": 2–5 short bullet strings arguing against the thesis or contradicting it. This is the priority — be a real skeptic. Include base-rate weakness where relevant.
- "thesisRestated": one clear sentence of what the user is really betting on.
- "assumptions": 3–6 SHORT, ATOMIC, standalone statements that must each be true for the thesis to work. Each must stand alone and be independently checkable — no compound clauses, no "and/but", no references to other items. Example: "NVDA keeps growing data-center revenue" — not "revenue grows and margins hold".
- "stressTest": 1–3 sentences on what breaks the thesis, citing the base-rate hit rate, sample size (n) and worst-case EXACTLY as provided in baseRate. If baseRate.sufficient is false, say the sample is too small to lean on.
- "decision.call": "Trade", "Watch", or "Pass" — a RECOMMENDATION only (the user decides). "decision.reasoning": 1–2 sentences tied to the evidence and base rate.
- "confidence.rationale": how much to trust this read, referencing the sample size and data limitations. "confidence.unknowns": 2–5 short bullets of what you do NOT know or cannot see (e.g. no analyst consensus, generic filing titles, small sample, no forward estimates).
- Keep every string concise. Arrays: 6 items max. Output ONLY the JSON object.`;

function asStr(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}
function asList(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => (typeof x === "string" ? x.trim() : "")).filter(Boolean).slice(0, 6);
}
function coerceCall(v: unknown): "Trade" | "Watch" | "Pass" {
  const s = String(v ?? "").toLowerCase();
  if (s.includes("trade")) return "Trade";
  if (s.includes("pass")) return "Pass";
  return "Watch";
}

/** Normalize/validate the model output; return null if it lacks substance. */
export function coerceIntelligence(raw: any): Intelligence | null {
  if (!raw || typeof raw !== "object") return null;
  const intel: Intelligence = {
    situation: asStr(raw.situation),
    evidenceFor: asList(raw.evidenceFor),
    evidenceAgainst: asList(raw.evidenceAgainst),
    thesisRestated: asStr(raw.thesisRestated ?? raw.thesis),
    assumptions: asList(raw.assumptions),
    stressTest: asStr(raw.stressTest),
    decision: { call: coerceCall(raw?.decision?.call), reasoning: asStr(raw?.decision?.reasoning) },
    confidence: { rationale: asStr(raw?.confidence?.rationale), unknowns: asList(raw?.confidence?.unknowns) },
  };
  // Require at least some real content, else treat as failed (UI falls back).
  const hasSubstance = intel.situation || intel.thesisRestated || intel.evidenceAgainst.length > 0 || intel.assumptions.length > 0;
  return hasSubstance ? intel : null;
}

/** Build the structured intelligence; returns null on any failure (caller falls back). */
export async function buildIntelligence(facts: unknown): Promise<Intelligence | null> {
  try {
    const raw = await qwenJson<any>(SYSTEM, JSON.stringify(facts));
    return coerceIntelligence(raw);
  } catch (e) {
    console.warn("[intelligence] structured synthesis failed — UI will show base-rate fallback:", e instanceof Error ? e.message : String(e));
    return null; // malformed JSON / network — grounded engine numbers still render
  }
}