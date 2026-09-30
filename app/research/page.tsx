"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import PriceChart from "@/components/price-chart";
import { thesesStore, newId } from "@/lib/storage";
import {
  AIAnalysis, Card, SectionLabel, Stat, DECISION, dir, fmt, pctf,
  type Stress, type Intelligence, type NewsItem, type EarningsSummary, type SavedThesis,
} from "@/components/analysis-ui";

type Analysis = {
  idea: string; ticker: string; companyName?: string; direction: "long" | "short" | "unclear"; thesis: string; setupLabel: string;
  quote: { price: number | null; asOf?: string; currency?: string } | null;
  earnings: { latest: EarningsSummary | null; historyCount: number };
  estimates: { available: boolean; forwardEps?: number | null; forwardPe?: number | null; targetPriceMean?: number | null; consensusRating?: string | null };
  news: { items: NewsItem[] };
  takeaway: string;
  historical: { eventsProvided: number; eventsUsable: number; eventDatesUsed: string[]; pop: { preEarningsDate: string; preEarningsClose: number; currentClose: number; popPct: number } | null };
  stress: Stress; stressBrief: string; dataNotes: string[]; meta: { model: string };
  intelligence: Intelligence | null;
};
type ErrorPayload = { code: "TICKER_NOT_FOUND" | "QWEN_KEY_MISSING" | "UPSTREAM_ERROR"; tone: "amber" | "neutral" | "red"; title: string; body: string; ticker?: string; suggestion?: { symbol: string; name: string } | null };
type Pulse = { ok?: boolean; symbol: string; name?: string; price?: number | null; asOf?: string | null; changePct?: number | null; change5dPct?: number | null; change30dPct?: number | null; low52?: number | null; high52?: number | null; history?: { date: string; close: number }[] };

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
const EXAMPLES = [{ dir: "long", text: "NVDA after an earnings beat" }, { dir: "short", text: "TSLA into delivery numbers" }, { dir: "long", text: "AAPL on a guidance raise" }, { dir: "short", text: "NFLX after a miss" }] as const;
const STEPS = [{ title: "Reading your thesis", sub: "" }, { title: "Pulling price history and filings", sub: "" }, { title: "Computing base rates", sub: "Finding past setups like yours and measuring how they moved" }, { title: "Stress-testing the trade", sub: "" }];

type Phase = "idle" | "loading" | "result" | "error";

function ResearchInner() {
  const params = useSearchParams();
  const symbolParam = params.get("symbol");
  const [idea, setIdea] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [step, setStep] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [stepTimes, setStepTimes] = useState<number[]>([]);
  const elapsedRef = useRef(0);
  const [result, setResult] = useState<Analysis | null>(null);
  const [pulse, setPulse] = useState<Pulse | null>(null);
  const [err, setErr] = useState<ErrorPayload | null>(null);
  const stepTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const secTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (phase === "loading") {
      setStep(0); setElapsed(0); setStepTimes([]); elapsedRef.current = 0;
      secTimer.current = setInterval(() => { elapsedRef.current += 1; setElapsed(elapsedRef.current); }, 1000);
      stepTimer.current = setInterval(() => setStep((s) => {
        const next = Math.min(s + 1, STEPS.length - 1);
        if (next !== s) setStepTimes((t) => { const c = t.slice(); c[s] = elapsedRef.current; return c; });
        return next;
      }), 5000);
    }
    return () => { if (stepTimer.current) clearInterval(stepTimer.current); if (secTimer.current) clearInterval(secTimer.current); };
  }, [phase]);

  useEffect(() => {
    if (symbolParam && !started.current) { started.current = true; run(symbolParam); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbolParam]);

  async function fetchPulse(sym: string) {
    try { const res = await fetch(`/api/pulse?symbol=${encodeURIComponent(sym)}`); if (res.ok) setPulse((await res.json()) as Pulse); } catch { /* chart just won't show */ }
  }

  async function run(q?: string) {
    const text = (q ?? idea).trim();
    if (!text) return;
    if (q) setIdea(q);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setPhase("loading"); setResult(null); setPulse(null); setErr(null);
    const guess = text.match(/\b[A-Z]{1,5}\b/)?.[0];
    if (guess) fetchPulse(guess);
    try {
      const res = await fetch("/api/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idea: text }), signal: ctrl.signal });
      const json = await res.json();
      if (!res.ok) { setErr(json?.error ?? { code: "UPSTREAM_ERROR", tone: "red", title: "Something went wrong on our end", body: "A data source didn't respond." }); setPhase("error"); return; }
      const r = json as Analysis;
      setResult(r); setPhase("result");
      if (!guess || guess !== r.ticker) fetchPulse(r.ticker);
    } catch (e) {
      if ((e as Error)?.name === "AbortError") { setPhase("idle"); return; }
      setErr({ code: "UPSTREAM_ERROR", tone: "red", title: "Something went wrong on our end", body: "A data source didn't respond. Your idea is kept in the box, so retrying is one click." });
      setPhase("error");
    }
  }
  function cancel() { abortRef.current?.abort(); setPhase("idle"); }
  function reset(keep: boolean) { if (keep && result) setIdea(result.idea); else setIdea(""); setResult(null); setPulse(null); setErr(null); setPhase("idle"); }
  function acceptSuggestion(sym: string) { run(err?.ticker ? idea.replace(new RegExp(err.ticker, "i"), sym) : `${sym} ${idea}`); }

  const isResult = phase === "result" && result;

  return (
    <div className="min-h-screen">
      {(phase === "idle" || phase === "error") && (
        <main className="mx-auto max-w-[760px] px-6 py-10">
          {phase === "idle" ? (
            <div className="pt-10 text-center">
              <span className="animate-in inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1 text-xs text-[var(--text-dim)]"><span className="h-1.5 w-1.5 rounded-full bg-red-400" /> Built to challenge your trade, not cheer it on</span>
              <h1 className="animate-in mt-6 text-balance text-4xl font-semibold tracking-[-0.02em] text-[var(--text)] sm:text-5xl" style={{ animationDelay: "40ms" }}>Research an idea</h1>
              <p className="animate-in mx-auto mt-4 max-w-lg text-[15px] leading-relaxed text-[var(--text-dim)]" style={{ animationDelay: "80ms" }}>Describe the trade in plain words. Reckon reads the filings, checks how similar setups moved, and argues the other side.</p>
            </div>
          ) : (
            <h1 className="animate-in pt-4 text-center text-2xl font-semibold tracking-[-0.02em] text-[var(--text)] sm:text-3xl">Research an idea</h1>
          )}

          {!(phase === "error" && err?.code === "QWEN_KEY_MISSING") && (
            <div className="animate-in mt-8" style={{ animationDelay: "120ms" }}>
              <div className={`overflow-hidden rounded-2xl border bg-[var(--surface)] transition-colors ${phase === "error" && err?.tone === "amber" ? "border-amber-400/50" : "border-[var(--border)] focus-within:border-[var(--border-2)]"}`}>
                <div className="flex items-center gap-3 px-4 py-3.5">
                  <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-[var(--text-mute)]" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4-4" strokeLinecap="round" /></svg>
                  <input value={idea} onChange={(e) => setIdea(e.target.value)} onKeyDown={(e) => e.key === "Enter" && run()} placeholder="e.g. Long NVDA, they beat earnings and I think it keeps drifting up" className="flex-1 bg-transparent text-[15px] text-[var(--text)] outline-none placeholder:text-[var(--text-mute)]" />
                  <button onClick={() => run()} disabled={!idea.trim()} className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--accent-text)] transition hover:bg-[var(--accent-hover)] disabled:opacity-40">Analyze <span aria-hidden>→</span></button>
                </div>
                <div className="flex items-center justify-between border-t border-[var(--border)] px-4 py-2.5 text-xs text-[var(--text-mute)]"><span>Include a ticker and a direction (long or short)</span><span className="mono">Enter ↵</span></div>
              </div>
            </div>
          )}

          {phase === "error" && err && <ErrorCard err={err} onRetry={() => run(idea)} onSuggest={acceptSuggestion} />}

          {phase === "idle" && (
            <div className="animate-in mt-5 flex flex-wrap items-center justify-center gap-2.5" style={{ animationDelay: "180ms" }}>
              <span className="text-xs text-[var(--text-mute)]">Try</span>
              {EXAMPLES.map((ex) => (
                <button key={ex.text} onClick={() => run(`${ex.dir === "long" ? "Long" : "Short"} ${ex.text}`)} className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs text-[var(--text-dim)] transition-all hover:-translate-y-0.5 hover:border-[var(--border-2)] hover:text-[var(--text)]">
                  <span className={`mono rounded px-1.5 py-0.5 text-[10px] font-medium ${ex.dir === "long" ? "text-emerald-300 bg-emerald-400/12" : "text-red-300 bg-red-400/12"}`}>{ex.dir === "long" ? "LONG" : "SHORT"}</span>{ex.text}
                </button>
              ))}
            </div>
          )}
        </main>
      )}

      {phase === "loading" && (
        <main className="mx-auto max-w-[760px] px-6 py-10">
          <div className="animate-in flex justify-center"><span className="inline-flex max-w-full items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm">
            {(() => { const d = (idea.match(/\b(long|short)\b/i)?.[0] ?? "").toLowerCase(); const arrow = d === "long" ? "↗" : d === "short" ? "↘" : "•"; const cls = d === "short" ? "text-red-300 bg-red-400/12" : d === "long" ? "text-emerald-300 bg-emerald-400/12" : "text-neutral-300 bg-white/5"; return <span className={`mono inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium ${cls}`}><span aria-hidden>{arrow}</span>{d ? d.toUpperCase() : "IDEA"}</span>; })()}
            <span className="text-[var(--text-dim)] line-clamp-1">{idea}</span></span></div>
          <Card className="mt-6 p-6" delay={80}>
            <div className="flex items-start justify-between"><div><h2 className="text-lg font-semibold text-[var(--text)]">Checking your idea against history</h2><p className="mt-1 text-sm text-[var(--text-dim)]">Usually about 20 seconds. Worth the wait: this is the part that argues back.</p></div><span className="mono text-sm text-[var(--text-mute)]">{mmss(elapsed)}</span></div>
            <div className="mt-5 h-1 w-full overflow-hidden rounded-full bg-white/[0.06]"><div className="h-full rounded-full bg-indigo-400 transition-[width] duration-700 ease-out" style={{ width: `${((step + 0.6) / STEPS.length) * 100}%` }} /></div>
            <div className="mt-5 space-y-1">
              {STEPS.map((s, i) => { const done = i < step, active = i === step; return (
                <div key={s.title} className={`flex items-start justify-between rounded-xl px-3 py-2.5 ${active ? "bg-white/[0.04]" : ""}`}><div className="flex items-start gap-3"><span className={`mt-0.5 grid h-4 w-4 place-items-center rounded-full text-[10px] ${done ? "bg-emerald-400/20 text-emerald-300" : active ? "border border-white/30 softpulse" : "border border-white/12"}`}>{done ? "✓" : ""}</span><div><div className={`text-sm ${done ? "text-[var(--text-dim)]" : active ? "text-[var(--text)]" : "text-[var(--text-mute)]"}`}>{s.title}</div>{active && s.sub && <div className="mt-0.5 text-xs text-[var(--text-mute)]">{s.sub}</div>}</div></div>{done && <span className="mono text-xs text-[var(--text-mute)]">{stepTimes[i] != null ? mmss(stepTimes[i]) : "done"}</span>}</div>
              ); })}
            </div>
            <div className="mt-5 flex items-center justify-between border-t border-[var(--border)] pt-4"><span className="text-sm text-[var(--text-mute)]">Results appear here. You can switch tabs meanwhile.</span><button onClick={cancel} className="rounded-lg border border-[var(--border-2)] bg-[var(--surface-2)] px-3.5 py-1.5 text-sm text-[var(--text-dim)] transition hover:text-[var(--text)]">Cancel</button></div>
          </Card>
        </main>
      )}

      {isResult && result && <Results r={result} pulse={pulse} onNew={() => reset(false)} onEdit={() => reset(true)} />}
    </div>
  );
}

function ErrorCard({ err, onRetry, onSuggest }: { err: ErrorPayload; onRetry: () => void; onSuggest: (s: string) => void }) {
  const toneRing = err.tone === "amber" ? "border-amber-400/25" : err.tone === "red" ? "border-red-400/25" : "border-[var(--border)]";
  const iconWrap = err.tone === "amber" ? "bg-amber-400/12 text-amber-300" : err.tone === "red" ? "bg-red-400/12 text-red-300" : "bg-white/[0.06] text-[var(--text-dim)]";
  const icon = err.tone === "amber" ? <path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /> : err.tone === "red" ? <><circle cx="12" cy="12" r="9" /><path d="M15 9l-6 6M9 9l6 6" strokeLinecap="round" /></> : <><circle cx="12" cy="12" r="3" /><path d="M12 3v3M12 18v3M3 12h3M18 12h3" strokeLinecap="round" /></>;
  return (
    <Card className={`mt-4 p-5 ${toneRing}`}>
      <div className="flex items-start gap-4">
        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${iconWrap}`}><svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">{icon}</svg></span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3"><h3 className="text-sm font-semibold text-[var(--text)]">{err.title.split(err.ticker ?? "\u0000").flatMap((p, i, arr) => (i < arr.length - 1 ? [p, <span key={i} className="mono text-amber-300">{err.ticker}</span>] : [p]))}</h3><span className="mono shrink-0 text-[11px] text-[var(--text-mute)]">{err.code === "QWEN_KEY_MISSING" ? "ENGINE_NOT_CONFIGURED" : err.code}</span></div>
          <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--text-dim)]">{err.body}</p>
          <div className="mt-3 flex items-center gap-3">
            {err.code === "UPSTREAM_ERROR" && <button onClick={onRetry} className="rounded-lg bg-[var(--accent)] px-4 py-1.5 text-sm font-semibold text-[var(--accent-text)] transition hover:bg-[var(--accent-hover)]">Try again</button>}
            {err.code === "QWEN_KEY_MISSING" && <span className="text-xs text-[var(--text-mute)]">No action needed</span>}
            {err.code === "TICKER_NOT_FOUND" && err.suggestion && <div className="flex items-center gap-2 text-xs text-[var(--text-mute)]">Did you mean<button onClick={() => onSuggest(err.suggestion!.symbol)} className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-2)] bg-[var(--surface-2)] px-2.5 py-1 transition hover:border-white/25"><span className="mono font-medium text-[var(--text)]">{err.suggestion.symbol}</span><span className="text-[var(--text-dim)]">{err.suggestion.name}</span></button></div>}
          </div>
        </div>
      </div>
    </Card>
  );
}

function buildSaved(r: Analysis, decision: "Trade" | "Watch" | "Pass"): SavedThesis {
  return {
    id: newId("thesis"),
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

const OPTS = { Trade: "Commit to the idea and plan the order.", Watch: "Keep it on your list and wait for better evidence.", Pass: "Walk away. The case against wins." } as const;
const OPT_COLOR = { Trade: "text-emerald-300", Watch: "text-amber-300", Pass: "text-red-300" } as const;
const OPT_DOT = { Trade: "bg-emerald-400", Watch: "bg-amber-400", Pass: "bg-red-400" } as const;
const OPT_SEL = { Trade: "border-emerald-400/50 bg-emerald-400/[0.06]", Watch: "border-amber-400/50 bg-amber-400/[0.06]", Pass: "border-red-400/50 bg-red-400/[0.06]" } as const;
const shortDate = (d: string) => { try { return new Date(d + "T00:00:00Z").toLocaleDateString(undefined, { month: "short", day: "numeric" }); } catch { return d; } };

function Results({ r, pulse, onNew, onEdit }: { r: Analysis; pulse: Pulse | null; onNew: () => void; onEdit: () => void }) {
  const d = dir[r.direction];
  const price = pulse?.price ?? r.quote?.price ?? null;
  const up = (pulse?.changePct ?? 0) >= 0;
  const closes = (pulse?.history ?? []).map((h) => h.close);
  const axis = (pulse?.history?.length ?? 0) > 1 ? [0, 0.33, 0.66, 1].map((f) => shortDate(pulse!.history![Math.round(f * (pulse!.history!.length - 1))].date)) : [];

  const aiCall = r.intelligence?.decision.call ?? null;
  const [decision, setDecision] = useState<"Trade" | "Watch" | "Pass" | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);

  function commit() {
    if (!decision) return;
    const thesis = buildSaved(r, decision);
    thesesStore.upsert(thesis);
    setSavedId(thesis.id);
  }

  return (
    <main className="mx-auto max-w-[1180px] px-6 pb-16 pt-8">
      {/* idea banner */}
      <Card className="p-5">
        <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
          <div className="flex items-center gap-3.5"><span className="mono grid h-11 w-11 place-items-center rounded-xl bg-[var(--surface-2)] text-sm font-medium text-[var(--text-dim)]">{r.ticker.slice(0, 2)}</span><div><div className="flex items-center gap-2"><span className="text-lg font-semibold tracking-tight">{r.ticker}</span><span className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium ring-1 ring-inset ${d.cls}`}><span aria-hidden>{d.arrow}</span>{d.label}</span></div><div className="text-xs text-[var(--text-dim)]">{r.companyName ?? r.ticker}</div></div></div>
          <div className="min-w-[220px] flex-1 border-l border-[var(--border)] pl-8"><div className="text-[11px] uppercase tracking-wide text-[var(--text-mute)]">Your idea, restated</div><p className="mt-1 text-sm leading-relaxed text-[var(--text)]">{r.thesis}</p></div>
          <div className="flex items-center gap-2"><button onClick={onEdit} className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3.5 py-2 text-sm text-[var(--text-dim)] transition hover:border-[var(--border-2)] hover:text-[var(--text)]">Edit idea</button><button onClick={onNew} className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3.5 py-2 text-sm text-[var(--text-dim)] transition hover:border-[var(--border-2)] hover:text-[var(--text)]">New</button></div>
        </div>
      </Card>

      {/* overview + news */}
      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_340px]">
        <Card className="p-5" delay={40}>
          <div className="flex items-start justify-between gap-3">
            <div><div className="flex flex-wrap items-end gap-x-4 gap-y-1"><span className="mono text-3xl font-semibold text-[var(--text)]">{price != null ? `$${fmt(price)}` : "—"}</span><span className={`mono pb-1 text-sm ${up ? "text-emerald-300" : "text-red-300"}`}><span aria-hidden>{up ? "▲" : "▼"}</span> {pctf(pulse?.changePct)} <span className="text-[var(--text-mute)]">last session</span></span></div></div>
            <span className="mono shrink-0 text-xs text-[var(--text-mute)]">{pulse?.asOf ? `EOD close · ${shortDate(pulse.asOf)}` : "EOD close"}</span>
          </div>
          <div className="mt-4">{closes.length > 1 ? <PriceChart closes={closes} height={180} /> : <div className="grid h-[180px] place-items-center text-sm text-[var(--text-mute)]">Loading price history…</div>}</div>
          {axis.length > 0 && <div className="mono mt-2 flex justify-between text-[11px] text-[var(--text-mute)]">{axis.map((a, i) => <span key={i}>{a}</span>)}</div>}
          <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            <Stat label="5D" value={pctf(pulse?.change5dPct)} mono /><Stat label="30D" value={pctf(pulse?.change30dPct)} mono />
            <Stat label="52w range" value={pulse?.low52 != null ? `$${fmt(pulse.low52, 0)}–$${fmt(pulse.high52, 0)}` : "—"} mono />
            <Stat label="Reported EPS" value={r.earnings.latest?.epsActual != null ? `$${fmt(r.earnings.latest.epsActual)}` : "—"} mono />
            <Stat label="Period" value={r.earnings.latest?.fiscalPeriod ?? "—"} mono /><Stat label="Earnings on file" value={String(r.earnings.historyCount)} mono />
          </div>
        </Card>

        <Card className="p-5" delay={80}>
          <SectionLabel right="SEC EDGAR">News &amp; filings</SectionLabel>
          {r.news.items.length ? (
            <ul className="mt-1 divide-y divide-[var(--border)]">{r.news.items.slice(0, 6).map((n, i) => (
              <li key={i}><a href={n.url} target="_blank" rel="noreferrer" className="group flex items-center gap-2.5 py-2.5"><span className="mono w-[74px] shrink-0 text-[11px] text-[var(--text-mute)]">{n.publishedAt ?? "—"}</span><span className="mono shrink-0 rounded border border-[var(--border)] bg-[var(--surface-2)] px-1 py-0.5 text-[10px] text-[var(--text-dim)]">{n.formType ?? "SEC"}</span><span className="min-w-0 flex-1"><span className="block truncate text-[13px] text-[var(--text)]">{n.title}</span>{n.summary && <span className="block truncate text-[11px] text-[var(--text-dim)]">{n.summary}</span>}</span><svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0 text-[var(--text-mute)] transition group-hover:text-[var(--text)]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M7 17L17 7M9 7h8v8" /></svg></a></li>
            ))}</ul>
          ) : <p className="mt-3 text-sm text-[var(--text-mute)]">No recent filings found.</p>}
        </Card>
      </div>

      <AIAnalysis r={r} />

      {/* your decision */}
      {!savedId ? (
        <Card className="mt-4 border-[var(--border-2)] p-5" delay={40}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><h2 className="text-[15px] font-semibold text-[var(--text)]">Your decision</h2><p className="mt-1 text-sm text-[var(--text-dim)]">{aiCall ? <>Reckon suggested <span className="font-medium text-[var(--text)]">{aiCall}</span>. The call is yours, and yours is what gets recorded.</> : "You make the final call. The AI recommendation is above."}</p></div>
            <span className="text-xs text-[var(--text-mute)]">Stored on this device</span>
          </div>
          <div className="mt-4 grid gap-2.5 sm:grid-cols-3">
            {(["Trade", "Watch", "Pass"] as const).map((c) => {
              const on = decision === c;
              return (
                <button key={c} onClick={() => setDecision(c)} className={`rounded-xl border p-4 text-left transition ${on ? OPT_SEL[c] : "border-[var(--border)] bg-[var(--surface-2)] hover:border-[var(--border-2)]"}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className={`flex items-center gap-1.5 text-sm font-semibold ${OPT_COLOR[c]}`}><span className={`h-1.5 w-1.5 rounded-full ${OPT_DOT[c]}`} />{c}</span>
                    {aiCall === c && <span className="mono rounded bg-[var(--surface)] px-1.5 py-0.5 text-[10px] text-[var(--text-mute)]">AI&apos;s pick</span>}
                  </div>
                  <p className="mt-1.5 text-xs leading-relaxed text-[var(--text-dim)]">{OPTS[c]}</p>
                </button>
              );
            })}
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs text-[var(--text-mute)]">{decision && aiCall && decision !== aiCall ? "You're overriding the AI's suggestion. That's allowed. It's noted on the thesis." : "Your decision is recorded on the thesis."}</span>
            <button onClick={commit} disabled={!decision} className="rounded-xl bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-[var(--accent-text)] transition hover:bg-[var(--accent-hover)] disabled:opacity-40">Save to My Theses</button>
          </div>
        </Card>
      ) : (
        <div className="animate-in mt-4 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-emerald-400/30 bg-emerald-400/[0.05] p-5">
          <div className="flex items-center gap-3.5">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-emerald-400/15 text-emerald-300"><svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4L19 7" /></svg></span>
            <div><div className="flex items-center gap-2"><span className="text-base font-semibold text-[var(--text)]">Saved as</span><span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${OPT_COLOR[decision!]}`}><span className={`h-1.5 w-1.5 rounded-full ${OPT_DOT[decision!]}`} />{decision}</span></div><div className="text-xs text-[var(--text-mute)]">{r.ticker} · {r.direction === "short" ? "Short" : "Long"} · stored on this device</div></div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/theses" className="rounded-lg px-3 py-1.5 text-sm text-[var(--text-dim)] transition hover:text-[var(--text)]">My theses</Link>
            <Link href={`/theses/${savedId}`} className="rounded-lg border border-[var(--border-2)] bg-[var(--surface-2)] px-3.5 py-1.5 text-sm text-[var(--text)] transition hover:border-white/25">View thesis</Link>
            {decision === "Trade" && <Link href={`/execute/${savedId}`} className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent)] px-3.5 py-1.5 text-sm font-semibold text-[var(--accent-text)] transition hover:bg-[var(--accent-hover)]">Execute trade <span aria-hidden>→</span></Link>}
          </div>
        </div>
      )}

      <footer className="mt-10 flex flex-col items-start justify-between gap-3 border-t border-[var(--border)] pt-6 text-xs text-[var(--text-mute)] sm:flex-row"><p className="max-w-2xl leading-relaxed">Reckon is for research and education. It isn&apos;t financial advice, and how past setups moved doesn&apos;t guarantee how this one will.</p><span className="shrink-0">Powered by <span className="font-medium text-[var(--text-dim)]">Qwen</span></span></footer>
    </main>
  );
}

export default function ResearchPage() {
  return <Suspense fallback={<div className="px-6 py-10 text-sm text-[var(--text-mute)]">Loading…</div>}><ResearchInner /></Suspense>;
}