"use client";

import { useEffect, useState } from "react";

/* Shared analysis UI kit — used by the Research page and the saved-thesis detail
   view so the 8 AI-analysis sections render identically in both. */

/* ── types ── */
export type EarningsSummary = { fiscalPeriod?: string; reportDate?: string; epsActual?: number | null; epsEstimate?: number | null; surprisePct?: number | null; beatMiss?: "beat" | "miss" | "inline" | null; consensusAvailable: boolean };
export type RiskFlag = { label: string; detail: string; severity: "info" | "caution" | "warn" };
export type PerHorizon = { horizonDays: number; n: number; baseRatePct: number | null; meanReturnPct: number; medianReturnPct: number; worstPct: number; bestPct: number };
export type Stress = { direction: "long" | "short" | "unclear"; primaryHorizon: number; sampleSize: number; confidence: "insufficient" | "low" | "moderate" | "high"; sufficient: boolean; baseRatePct: number | null; favorableLabel: string; distribution: { meanReturnPct: number; medianReturnPct: number; bestPct: number; worstPct: number } | null; perHorizon: PerHorizon[]; riskFlags: RiskFlag[]; summary: string };
export type NewsItem = { title: string; url?: string; source?: string; publishedAt?: string; summary?: string; formType?: string };
export type IntelDecision = { call: "Trade" | "Watch" | "Pass"; reasoning: string };
export type Intelligence = { situation: string; evidenceFor: string[]; evidenceAgainst: string[]; thesisRestated: string; assumptions: string[]; stressTest: string; decision: IntelDecision; confidence: { rationale: string; unknowns: string[] } };

/** Minimum an AIAnalysis render needs (Analysis and SavedThesis both satisfy it). */
export type AnalysisView = {
  ticker: string;
  companyName?: string;
  direction: "long" | "short" | "unclear";
  thesis: string;
  setupLabel: string;
  earnings?: { latest: EarningsSummary | null; historyCount: number };
  stress: Stress;
  intelligence: Intelligence | null;
  takeaway: string;
  stressBrief: string;
  dataNotes: string[];
};

/** Trimmed record persisted to localStorage on decision commit. */
export type SavedThesis = AnalysisView & {
  id: string;
  createdAt: string;
  idea: string;
  decision: "Trade" | "Watch" | "Pass"; // the user's final call
  aiDecision: "Trade" | "Watch" | "Pass" | null; // the AI's suggestion
  assumptions: string[]; // snapshot (also inside intelligence, kept flat for review)
  earnings?: { latest: EarningsSummary | null; historyCount: number };
  quote?: { price: number | null; asOf?: string; currency?: string } | null;
  news?: { items: NewsItem[] };
};

/** The full /api/analyze result shape (used by Research and Review). */
export type FullAnalysis = AnalysisView & {
  idea: string;
  quote: { price: number | null; asOf?: string; currency?: string } | null;
  earnings: { latest: EarningsSummary | null; historyCount: number };
  estimates?: { available: boolean; forwardEps?: number | null; forwardPe?: number | null; targetPriceMean?: number | null; consensusRating?: string | null };
  news: { items: NewsItem[] };
};

/** A tracked position, persisted to reckon:portfolio. */
export type Position = {
  id: string;
  createdAt: string;
  ticker: string;
  side: "long" | "short";
  size: number; // shares / units
  entryPrice: number;
  openedAt: string;
  linkedThesisId?: string;
  stop?: number; // optional planned stop-loss (from the order ticket)
  target?: number; // optional planned target
  simulated?: boolean; // true = paper trade (no real order was placed)
};

/** Build a trimmed SavedThesis from a fresh analysis result + the user's decision. */
export function buildThesisFromResult(r: FullAnalysis, decision: "Trade" | "Watch" | "Pass", id: string): SavedThesis {
  return {
    id,
    createdAt: new Date().toISOString(),
    ticker: r.ticker, companyName: r.companyName, direction: r.direction,
    idea: r.idea, thesis: r.thesis, setupLabel: r.setupLabel,
    decision, aiDecision: r.intelligence?.decision.call ?? null,
    assumptions: r.intelligence?.assumptions ?? [],
    intelligence: r.intelligence, stress: r.stress,
    takeaway: r.takeaway, stressBrief: r.stressBrief, dataNotes: r.dataNotes,
    earnings: r.earnings, quote: r.quote,
    news: { items: r.news.items.slice(0, 8) },
  };
}

/* ── helpers ── */
export const fmt = (n?: number | null, dp = 2) => (typeof n === "number" && Number.isFinite(n) ? n.toFixed(dp) : "n/a");
export const pctf = (n?: number | null, dp = 1) => (typeof n === "number" && Number.isFinite(n) ? `${n >= 0 ? "+" : ""}${n.toFixed(dp)}%` : "n/a");

export const dir = {
  long: { label: "LONG", arrow: "↗", cls: "text-emerald-300 bg-emerald-400/12 ring-emerald-400/20" },
  short: { label: "SHORT", arrow: "↘", cls: "text-red-300 bg-red-400/12 ring-red-400/20" },
  unclear: { label: "IDEA", arrow: "•", cls: "text-neutral-300 bg-white/5 ring-white/10" },
} as const;
const conf = {
  high: { label: "High confidence", bars: 4, cls: "text-emerald-300", bar: "bg-emerald-400" },
  moderate: { label: "Moderate confidence", bars: 3, cls: "text-indigo-200", bar: "bg-indigo-300" },
  low: { label: "Low confidence", bars: 1, cls: "text-amber-300", bar: "bg-amber-400" },
  insufficient: { label: "Insufficient data", bars: 0, cls: "text-neutral-400", bar: "bg-neutral-500" },
} as const;
export const DECISION = {
  Trade: { cls: "text-emerald-300 bg-emerald-400/12 ring-emerald-400/25", dot: "bg-emerald-400" },
  Watch: { cls: "text-amber-300 bg-amber-400/12 ring-amber-400/25", dot: "bg-amber-400" },
  Pass: { cls: "text-red-300 bg-red-400/12 ring-red-400/25", dot: "bg-red-400" },
} as const;

/* ── atoms ── */
export function Card({ children, className = "", delay = 0, id }: { children: React.ReactNode; className?: string; delay?: number; id?: string }) {
  return <section id={id} className={`animate-in rounded-2xl border border-[var(--border)] bg-[var(--surface)] ${className}`} style={{ animationDelay: `${delay}ms` }}>{children}</section>;
}
export function SectionLabel({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return <div className="flex items-center justify-between gap-3"><h2 className="text-[15px] font-semibold text-[var(--text)]">{children}</h2>{right ? <span className="text-xs text-[var(--text-mute)]">{right}</span> : null}</div>;
}
export function ConfidenceBadge({ c }: { c: keyof typeof conf }) {
  const k = conf[c];
  return <span className={`inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-2.5 py-1 text-xs font-medium ${k.cls}`}><span className="flex items-end gap-[2px]">{[0, 1, 2, 3].map((i) => <span key={i} className={`w-[3px] rounded-sm ${i < k.bars ? k.bar : "bg-white/12"}`} style={{ height: `${6 + i * 2}px` }} />)}</span>{k.label}</span>;
}
export function Stat({ label, value, mono, dashed }: { label: string; value: string; mono?: boolean; dashed?: boolean }) {
  return <div className={`rounded-xl px-3 py-2.5 ${dashed ? "border border-dashed border-[var(--border-2)]" : "border border-[var(--border)] bg-[var(--surface-2)]"}`}><div className="text-[11px] text-[var(--text-mute)]">{label}</div><div className={`mt-0.5 text-sm font-medium ${dashed ? "text-[var(--text-dim)]" : "text-[var(--text)]"} ${mono ? "mono" : ""}`}>{value}</div></div>;
}
function HitLine({ pct, muted }: { pct: number | null; muted?: boolean }) {
  const v = typeof pct === "number" ? Math.max(0, Math.min(100, pct)) : 0;
  return <div className="h-[6px] w-full rounded-full bg-white/[0.05]"><div className="h-full rounded-full" style={{ width: `${v}%`, background: muted ? "rgba(255,255,255,0.28)" : "var(--up)" }} /></div>;
}
function RangeStrip({ worst, median, best, dmin, dmax, muted }: { worst: number; median: number; best: number; dmin: number; dmax: number; muted?: boolean }) {
  const span = dmax - dmin || 1;
  const x = (v: number) => ((Math.max(dmin, Math.min(dmax, v)) - dmin) / span) * 100;
  const red = muted ? "rgba(255,255,255,0.22)" : "var(--down)";
  const green = muted ? "rgba(255,255,255,0.3)" : "var(--up)";
  return (
    <div className="relative h-[6px] w-full rounded-full bg-white/[0.04]">
      <div className="absolute inset-y-0 rounded-l-full" style={{ left: `${x(worst)}%`, width: `${Math.max(0, x(0) - x(worst))}%`, background: red }} />
      <div className="absolute inset-y-0 rounded-r-full" style={{ left: `${x(0)}%`, width: `${Math.max(0, x(best) - x(0))}%`, background: green }} />
      <div className="absolute -top-1 -bottom-1 w-px bg-white/25" style={{ left: `${x(0)}%` }} />
      <div className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-[var(--surface)]" style={{ left: `${x(median)}%`, background: median >= 0 ? green : red }} />
    </div>
  );
}
export function DecisionChip({ call, prefix = "AI:" }: { call: "Trade" | "Watch" | "Pass"; prefix?: string }) {
  const k = DECISION[call];
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${k.cls}`}><span className={`h-1.5 w-1.5 rounded-full ${k.dot}`} />{prefix ? `${prefix} ${call}` : call}</span>;
}
function Bullets({ items, tone = "plain", empty }: { items: string[]; tone?: "for" | "against" | "plain"; empty?: string }) {
  const dot = tone === "for" ? "bg-emerald-400" : tone === "against" ? "bg-red-400" : "bg-[var(--text-mute)]";
  if (!items.length) return <p className="text-[13px] text-[var(--text-mute)]">{empty ?? "None identified from the available data."}</p>;
  return <ul className="space-y-2">{items.map((t, i) => <li key={i} className="flex gap-2.5 text-[13px] leading-relaxed text-[var(--text)]"><span className={`mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} />{t}</li>)}</ul>;
}

/** Engine base-rate hero — numbers come from the engine, not the LLM. */
function BaseRateBlock({ r }: { r: AnalysisView }) {
  const s = r.stress;
  const favCount = s.baseRatePct != null ? Math.round((s.baseRatePct / 100) * s.sampleSize) : 0;
  const low = s.confidence === "low";
  const dmin = Math.min(...s.perHorizon.map((h) => h.worstPct).concat(0));
  const dmax = Math.max(...s.perHorizon.map((h) => h.bestPct).concat(0));
  return (
    <div>
      <div className="flex items-center justify-between gap-3"><h3 className="text-sm font-semibold text-[var(--text)]">Historical base rate</h3><ConfidenceBadge c={s.confidence} /></div>
      {s.sufficient ? (
        <>
          <p className="mt-1 text-xs text-[var(--text-dim)]">From <span className="mono text-[var(--text)]">n = {s.sampleSize}</span> past {r.ticker} setups {r.setupLabel}</p>
          <div className="mt-4 flex items-end gap-4"><span className={`tnum text-5xl font-semibold leading-none tracking-tight ${low ? "text-[var(--text)]" : "text-emerald-400"}`}>{fmt(s.baseRatePct, 0)}%</span><div className="pb-1"><p className="text-sm text-[var(--text-dim)]">moved your way within {s.primaryHorizon} trading days</p><p className="mono mt-1 text-xs text-[var(--text-mute)]">{favCount} of {s.sampleSize}</p></div></div>
          <div className="mt-4"><div className="relative h-2 rounded-full bg-white/[0.05]"><div className="h-full rounded-full" style={{ width: `${Math.max(0, Math.min(100, s.baseRatePct ?? 0))}%`, background: low ? "rgba(255,255,255,0.3)" : "var(--up)" }} /><div className="absolute -top-1 -bottom-1 left-1/2 w-px bg-white/30" /></div><div className="mt-1.5 text-center text-[11px] text-[var(--text-mute)]">coin flip 50%</div></div>
          <div className="mt-5 space-y-5">
            {s.perHorizon.map((h) => (
              <div key={h.horizonDays}>
                <div className="flex items-center gap-3"><span className="mono rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-1.5 py-0.5 text-[11px] text-[var(--text-dim)]">{h.horizonDays}D</span><span className="tnum w-10 text-sm font-medium text-[var(--text)]">{h.baseRatePct != null ? `${fmt(h.baseRatePct, 0)}%` : "—"}</span><div className="flex-1"><HitLine pct={h.baseRatePct} muted={low} /></div></div>
                <div className="mt-2 pl-[4.4rem]"><RangeStrip worst={h.worstPct} median={h.medianReturnPct} best={h.bestPct} dmin={dmin} dmax={dmax} muted={low} /><div className="tnum mt-1.5 flex justify-between text-[11px]"><span className="text-red-300/80">worst {pctf(h.worstPct)}</span><span className="text-[var(--text-dim)]">median {pctf(h.medianReturnPct)}</span><span className="text-emerald-300/80">best {pctf(h.bestPct)}</span></div></div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="mt-4 grid place-items-center rounded-xl border border-dashed border-[var(--border-2)] px-6 py-8 text-center"><h4 className="text-sm font-semibold text-[var(--text)]">Not enough history to measure (n = {s.sampleSize})</h4><p className="mt-2 max-w-sm text-[13px] text-[var(--text-dim)]">Too few past setups for a reliable hit rate. The rest of the stress test still applies.</p></div>
      )}
    </div>
  );
}
function RiskFlags({ flags }: { flags: Stress["riskFlags"] }) {
  if (!flags.length) return null;
  return (
    <div className="space-y-2">
      {flags.map((f, i) => { const tag = f.severity === "warn" ? ["WARN", "text-red-300 bg-red-400/14"] : f.severity === "caution" ? ["CAUTION", "text-amber-300 bg-amber-400/14"] : ["INFO", "text-indigo-200 bg-indigo-400/16"]; return (
        <div key={i} className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5"><span className={`mono shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${tag[1]}`}>{tag[0]}</span><span className="text-[13px] text-[var(--text)]">{f.detail}</span></div>
      ); })}
    </div>
  );
}

/* section header: number + title + right label/badge */
function SecHead({ n, t, label, right }: { n: string; t: string; label?: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-baseline gap-2"><span className="mono text-xs text-[var(--text-mute)]">{n}</span><h3 className="text-[15px] font-semibold text-[var(--text)]">{t}</h3></div>
      {right ?? (label ? <span className="text-xs text-[var(--text-mute)]">{label}</span> : null)}
    </div>
  );
}

const MEMO: [string, string, string][] = [
  ["01", "Situation", "situation"], ["02", "Evidence for", "evidence"], ["03", "Evidence against", "evidence"],
  ["04", "The thesis", "thesis"], ["05", "Assumptions", "assumptions"], ["06", "Stress test", "stress"],
  ["07", "Decision", "decision"], ["08", "Confidence", "confidence"],
];
const SPY_IDS = ["situation", "evidence", "thesis", "assumptions", "stress", "decision", "confidence"];

/** The 8-section structured analysis with a "The memo" navigator (or graceful fallback). */
export function AIAnalysis({ r, headerRight }: { r: AnalysisView; headerRight?: React.ReactNode }) {
  const intel = r.intelligence;
  const [active, setActive] = useState("situation");

  useEffect(() => {
    if (!intel) return;
    const obs = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) setActive(e.target.id); }),
      { rootMargin: "-38% 0px -55% 0px", threshold: 0 },
    );
    SPY_IDS.forEach((id) => { const el = document.getElementById(id); if (el) obs.observe(el); });
    return () => obs.disconnect();
  }, [intel]);

  const header = (
    <div className="mt-10 mb-4 flex flex-wrap items-center justify-between gap-2">
      <div className="flex items-center gap-2.5"><h2 className="text-lg font-semibold tracking-tight text-[var(--text)]">AI analysis</h2>{intel && <DecisionChip call={intel.decision.call} prefix="" />}</div>
      {headerRight ?? <span className="text-xs text-[var(--text-mute)]">AI recommendation · you make the final call</span>}
    </div>
  );

  if (!intel) return <>{header}<Fallback r={r} /></>;
  const late = r.earnings?.latest;
  const dc = DECISION[intel.decision.call];

  return (
    <>
      {header}
      <div className="grid gap-6 lg:grid-cols-[188px_1fr]">
        {/* the memo */}
        <aside className="hidden lg:block">
          <div className="sticky top-[124px]">
            <div className="px-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-mute)]">The memo</div>
            <nav className="mt-2 space-y-0.5">
              {MEMO.map(([n, t, id]) => (
                <a key={n} href={`#${id}`} className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] transition ${active === id ? "bg-[var(--surface-2)] text-[var(--text)]" : "text-[var(--text-dim)] hover:text-[var(--text)]"}`}>
                  <span className="mono text-[10px] text-[var(--text-mute)]">{n}</span>{t}
                </a>
              ))}
            </nav>
          </div>
        </aside>

        {/* sections */}
        <div className="space-y-4">
          <Card id="situation" className="scroll-mt-28 p-5">
            <SecHead n="01" t="Situation" label="What actually happened" />
            <p className="mt-2.5 text-sm leading-relaxed text-[var(--text)]">{intel.situation || "—"}</p>
            {late && (
              <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                <Stat label="Period" value={late.fiscalPeriod ?? "—"} mono />
                <Stat label="Reported EPS" value={late.epsActual != null ? `$${fmt(late.epsActual)}` : "—"} mono />
                <Stat label="Consensus EPS" value={late.consensusAvailable ? `$${fmt(late.epsEstimate)}` : "Unavailable"} dashed={!late.consensusAvailable} />
                <Stat label="Beat / miss" value={late.consensusAvailable && late.beatMiss ? late.beatMiss : "Needs consensus"} dashed={!late.consensusAvailable} />
              </div>
            )}
          </Card>

          <div id="evidence" className="grid scroll-mt-28 gap-4 md:grid-cols-2">
            <Card className="p-5"><SecHead n="02" t="Evidence for" label="Supports the thesis" /><div className="mt-3"><Bullets items={intel.evidenceFor} tone="for" /></div></Card>
            <Card className="relative overflow-hidden border-red-400/20 p-5">
              <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-red-500/[0.07] to-transparent" />
              <div className="relative">
                <SecHead n="03" t="Evidence against" right={<span className="mono rounded bg-red-400/14 px-1.5 py-0.5 text-[10px] font-medium text-red-300">Read this first</span>} />
                <div className="mt-3"><Bullets items={intel.evidenceAgainst} tone="against" empty="No clear contradictions surfaced — but absence of evidence isn't confirmation." /></div>
              </div>
            </Card>
          </div>

          <Card id="thesis" className="scroll-mt-28 p-5"><SecHead n="04" t="The thesis" label="What you're really betting on" /><p className="mt-2.5 text-[15px] leading-relaxed text-[var(--text)]">{intel.thesisRestated || r.thesis}</p></Card>

          <Card id="assumptions" className="scroll-mt-28 p-5">
            <SecHead n="05" t="Assumptions" label="What must be true" />
            {intel.assumptions.length ? (
              <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
                {intel.assumptions.map((a, i) => (
                  <div key={i} className="flex gap-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface-2)]/50 p-3"><span className="mono shrink-0 text-[11px] font-medium text-[var(--text-mute)]">A{i + 1}</span><span className="text-[13px] leading-relaxed text-[var(--text)]">{a}</span></div>
                ))}
              </div>
            ) : <p className="mt-3 text-[13px] text-[var(--text-mute)]">No discrete assumptions identified.</p>}
          </Card>

          <Card id="stress" className="scroll-mt-28 p-5">
            <SecHead n="06" t="Stress test" label="What breaks the thesis" />
            {intel.stressTest && <p className="mt-2.5 text-sm leading-relaxed text-[var(--text)]">{intel.stressTest}</p>}
            <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_290px]">
              <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)]/40 p-4"><BaseRateBlock r={r} /></div>
              {r.stress.riskFlags.length > 0 && <div><div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-mute)]">Risk flags</div><div className="mt-2"><RiskFlags flags={r.stress.riskFlags} /></div></div>}
            </div>
          </Card>

          <Card id="decision" className="scroll-mt-28 p-5">
            <SecHead n="07" t="Decision" />
            <div className="mt-3 flex flex-wrap items-start gap-4">
              <span className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold ring-1 ring-inset ${dc.cls}`}><span className={`h-1.5 w-1.5 rounded-full ${dc.dot}`} />{intel.decision.call}</span>
              <p className="flex-1 text-sm leading-relaxed text-[var(--text)]">{intel.decision.reasoning || "—"}</p>
            </div>
            <p className="mt-3 text-xs text-[var(--text-mute)]">AI recommendation only. Your decision is recorded below.</p>
          </Card>

          <Card id="confidence" className="scroll-mt-28 p-5">
            <SecHead n="08" t="Confidence and blind spots" right={<ConfidenceBadge c={r.stress.confidence} />} />
            {intel.confidence.rationale && <p className="mt-3 text-sm leading-relaxed text-[var(--text-dim)]">{intel.confidence.rationale}</p>}
            <div className="mt-4 grid gap-5 sm:grid-cols-2">
              <div><div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-mute)]">What the AI can&apos;t see</div><div className="mt-2"><Bullets items={intel.confidence.unknowns} empty="—" /></div></div>
              <div><div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-mute)]">Data notes</div><ul className="mt-2 space-y-1.5">{r.dataNotes.map((n, i) => <li key={i} className="flex gap-2 text-[13px] leading-relaxed text-[var(--text-dim)]"><span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[var(--text-mute)]" />{n}</li>)}</ul></div>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
function Fallback({ r }: { r: AnalysisView }) {
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <div className="space-y-4">
        <Card className="p-5"><BaseRateBlock r={r} /></Card>
        <Card className="p-5"><h2 className="text-[15px] font-semibold">Data notes</h2><ul className="mt-3 space-y-2.5">{r.dataNotes.map((n, i) => <li key={i} className="flex gap-2.5 text-[13px] leading-relaxed text-[var(--text-dim)]"><span className="mt-0.5 text-[var(--text-mute)]">ⓘ</span>{n}</li>)}</ul></Card>
      </div>
      <div className="space-y-4">
        <Card className="p-5"><SectionLabel right="Earnings and news">What actually happened</SectionLabel><div className="mt-3 space-y-3 text-sm leading-relaxed text-[var(--text)]">{(r.takeaway || "The structured analysis is unavailable, but the base-rate numbers above are computed directly from the data.").split(/\n\n+/).map((p, i) => <p key={i}>{p}</p>)}</div></Card>
        <Card className="relative overflow-hidden border-red-400/15 p-5"><SectionLabel right="The case against your trade">What could go wrong</SectionLabel><div className="mt-3 space-y-3 text-sm leading-relaxed text-[var(--text)]">{(r.stressBrief || "").split(/\n\n+/).map((p, i) => <p key={i}>{p}</p>)}</div><div className="mt-4"><RiskFlags flags={r.stress.riskFlags} /></div></Card>
      </div>
    </div>
  );
}