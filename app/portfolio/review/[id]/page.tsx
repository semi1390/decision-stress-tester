"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { portfolioStore, thesesStore, newId } from "@/lib/storage";
import { positionPnl } from "@/lib/portfolio";
import { AIAnalysis, dir, fmt, buildThesisFromResult, type Position, type SavedThesis, type FullAnalysis } from "@/components/analysis-ui";

const money = (n?: number | null) => (typeof n === "number" && Number.isFinite(n) ? `${n >= 0 ? "+" : "-"}$${Math.abs(n).toFixed(2)}` : "—");
const pctf = (n?: number | null) => (typeof n === "number" && Number.isFinite(n) ? `${n >= 0 ? "+" : ""}${n.toFixed(1)}%` : "—");
const upperDate = (iso: string) => { try { return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" }).toUpperCase(); } catch { return iso; } };
const OPT_COLOR: Record<string, string> = { Trade: "text-emerald-300", Watch: "text-amber-300", Pass: "text-red-300" };
const OPT_DOT: Record<string, string> = { Trade: "bg-emerald-400", Watch: "bg-amber-400", Pass: "bg-red-400" };
const OPT_SEL: Record<string, string> = { Trade: "border-emerald-400/50 bg-emerald-400/[0.06]", Watch: "border-amber-400/50 bg-amber-400/[0.06]", Pass: "border-red-400/50 bg-red-400/[0.06]" };
const RSTEPS = [{ t: "Pulling latest price and filings", sub: "" }, { t: "Computing base rates", sub: "Comparing against your saved numbers" }, { t: "Re-checking your assumptions", sub: "" }];

function Badge({ call }: { call: "Trade" | "Watch" | "Pass" }) {
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${OPT_COLOR[call]}`}><span className={`h-1.5 w-1.5 rounded-full ${OPT_DOT[call]}`} />{call}</span>;
}
function RateBar({ pct, muted }: { pct: number | null; muted?: boolean }) {
  const v = typeof pct === "number" ? Math.max(0, Math.min(100, pct)) : 0;
  return <div className="relative mt-2 h-1.5 rounded-full bg-white/[0.06]"><div className="h-full rounded-full" style={{ width: `${v}%`, background: muted ? "rgba(255,255,255,0.35)" : "var(--up)" }} /><div className="absolute -top-1 -bottom-1 left-1/2 w-px bg-white/25" /></div>;
}
function Assump({ items, tone }: { items: string[]; tone: "then" | "now" }) {
  const dot = tone === "now" ? "bg-indigo-300" : "bg-[var(--text-mute)]";
  if (!items.length) return <p className="text-[13px] text-[var(--text-mute)]">None recorded.</p>;
  return <div className="space-y-2">{items.map((a, i) => <div key={i} className="flex gap-2.5"><span className="mono shrink-0 text-[11px] text-[var(--text-mute)]">A{i + 1}</span><span className="text-[13px] leading-relaxed text-[var(--text)]"><span className={`mr-1.5 inline-block h-1.5 w-1.5 rounded-full ${dot} align-middle`} />{a}</span></div>)}</div>;
}

export default function ReviewPage() {
  const params = useParams();
  const router = useRouter();
  const id = String(params?.id ?? "");
  const [pos, setPos] = useState<Position | null | undefined>(undefined);
  const [thesis, setThesis] = useState<SavedThesis | null>(null);
  const [fresh, setFresh] = useState<FullAnalysis | null>(null);
  const [phase, setPhase] = useState<"loading" | "ready" | "error">("loading");
  const [rstep, setRstep] = useState(0);
  const [nowPrice, setNowPrice] = useState<number | null>(null);
  const [decision, setDecision] = useState<"Trade" | "Watch" | "Pass" | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const started = useRef(false);
  const tmr = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const p = (portfolioStore.get(id) as unknown as Position) ?? null;
    setPos(p);
    const t = p?.linkedThesisId ? ((thesesStore.get(p.linkedThesisId) as unknown as SavedThesis) ?? null) : null;
    setThesis(t);
    if (p) fetch(`/api/pulse?symbol=${encodeURIComponent(p.ticker)}`).then((r) => r.json()).then((j) => { if (j?.price != null) setNowPrice(Number(j.price)); }).catch(() => {});
    if (p && t && !started.current) { started.current = true; rerun(t.idea); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function rerun(idea: string) {
    setPhase("loading"); setRstep(0);
    if (tmr.current) clearInterval(tmr.current);
    tmr.current = setInterval(() => setRstep((s) => Math.min(s + 1, RSTEPS.length - 1)), 6000);
    try {
      const res = await fetch("/api/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idea }) });
      const json = await res.json();
      if (tmr.current) clearInterval(tmr.current);
      if (!res.ok) { setPhase("error"); return; }
      setFresh(json as FullAnalysis); setPhase("ready");
    } catch { if (tmr.current) clearInterval(tmr.current); setPhase("error"); }
  }

  if (pos === undefined) return <main className="px-6 py-10 text-sm text-[var(--text-mute)]">Loading…</main>;
  if (pos === null) return <NotFound />;
  if (!thesis) return (
    <main className="mx-auto max-w-[760px] px-6 py-16 text-center"><h1 className="text-xl font-semibold text-[var(--text)]">No linked thesis</h1><p className="mt-2 text-sm text-[var(--text-dim)]">This position has no saved thesis to compare against.</p><Link href="/portfolio" className="mt-5 inline-block rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--accent-text)]">Back to Portfolio</Link></main>
  );

  const d = dir[pos.side === "short" ? "short" : "long"];
  const { abs, pct } = positionPnl(pos, nowPrice);
  const thenRate = thesis.stress?.baseRatePct ?? null;
  const nowRate = fresh?.stress?.baseRatePct ?? null;
  const rateDelta = thenRate != null && nowRate != null ? nowRate - thenRate : null;

  function closePosition() { portfolioStore.remove(id); router.push("/portfolio"); }
  function updateThesis() { if (!fresh || !decision) return; const tid = newId("thesis"); thesesStore.upsert(buildThesisFromResult(fresh, decision, tid)); portfolioStore.upsert({ ...pos!, linkedThesisId: tid }); setDone(tid); }

  return (
    <main className="mx-auto max-w-[1180px] px-4 pb-16 pt-8 sm:px-6">
      <div className="flex items-center justify-between gap-3">
        <Link href="/portfolio" className="inline-flex items-center gap-1.5 text-sm text-[var(--text-dim)] transition hover:text-[var(--text)]"><span aria-hidden>‹</span> Portfolio</Link>
        <span className="text-xs text-[var(--text-mute)]">Reviewing your saved thesis against a fresh analysis</span>
      </div>

      {/* position header */}
      <div className="animate-in mt-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
          <div className="flex items-center gap-3.5"><span className="mono grid h-11 w-11 place-items-center rounded-xl bg-[var(--surface-2)] text-sm font-medium text-[var(--text-dim)]">{pos.ticker.slice(0, 2)}</span><div><div className="flex items-center gap-2"><span className="text-lg font-semibold tracking-tight">{pos.ticker}</span><span className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium ring-1 ring-inset ${d.cls}`}><span aria-hidden>{d.arrow}</span>{d.label}</span></div><div className="text-xs text-[var(--text-dim)]">{thesis.companyName ?? pos.ticker}</div></div></div>
          <div className="ml-auto flex flex-wrap items-center gap-6 sm:gap-8">
            <div><div className="text-[11px] uppercase tracking-wide text-[var(--text-mute)]">Size @ entry</div><div className="mono mt-0.5 text-sm text-[var(--text)]">{pos.size} @ ${fmt(pos.entryPrice)}</div></div>
            <div><div className="text-[11px] uppercase tracking-wide text-[var(--text-mute)]">Current</div><div className="mono mt-0.5 text-sm text-[var(--text)]">{nowPrice != null ? `$${fmt(nowPrice)}` : "—"}</div></div>
            <div><div className="text-[11px] uppercase tracking-wide text-[var(--text-mute)]">P&L</div><div className={`mono mt-0.5 text-sm font-medium ${(abs ?? 0) >= 0 ? "text-emerald-300" : "text-red-300"}`}>{money(abs)} · {pctf(pct)}</div></div>
          </div>
        </div>
      </div>

      {/* then vs now */}
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="animate-in rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <div className="flex items-center justify-between"><span className="mono text-[11px] uppercase tracking-wide text-[var(--text-mute)]">Then · {upperDate(thesis.createdAt)}</span></div>
          <div className="mt-2 flex items-center justify-between gap-2"><h3 className="text-[15px] font-semibold text-[var(--text)]">At entry: what you believed</h3><Badge call={thesis.decision} /></div>
          <div className="mt-4"><div className="text-[11px] text-[var(--text-mute)]">Base rate · {thesis.stress?.primaryHorizon ?? 5} days</div><div className="mt-1 flex items-baseline gap-2"><span className="tnum text-3xl font-semibold text-emerald-400">{thenRate != null ? `${fmt(thenRate, 0)}%` : "—"}</span><span className="mono text-xs text-[var(--text-mute)]">n = {thesis.stress?.sampleSize ?? "—"} · {thesis.stress?.confidence ?? "—"}</span></div><RateBar pct={thenRate} /></div>
          <div className="mt-5 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-mute)]">Assumptions, as saved</div>
          <div className="mt-2"><Assump items={thesis.assumptions ?? []} tone="then" /></div>
        </div>

        <div className="animate-in rounded-2xl border border-indigo-400/25 bg-[var(--surface)] p-5">
          <span className="mono text-[11px] uppercase tracking-wide text-indigo-300/80">Now · Fresh analysis</span>
          {phase === "loading" && (
            <div className="mt-3">
              <h3 className="text-lg font-semibold text-[var(--text)]">Re-running the analysis</h3>
              <p className="mt-1 text-sm text-[var(--text-dim)]">About 20 seconds. Your &ldquo;then&rdquo; column stays put while this loads.</p>
              <div className="mt-4 h-1 w-full overflow-hidden rounded-full bg-white/[0.06]"><div className="h-full rounded-full bg-amber-400 transition-[width] duration-700 ease-out" style={{ width: `${((rstep + 0.6) / RSTEPS.length) * 100}%` }} /></div>
              <div className="mt-4 space-y-1">{RSTEPS.map((s, i) => { const dn = i < rstep, ac = i === rstep; return (<div key={s.t} className={`flex items-start gap-3 rounded-xl px-3 py-2.5 ${ac ? "bg-white/[0.04]" : ""}`}><span className={`mt-0.5 grid h-4 w-4 place-items-center rounded-full text-[10px] ${dn ? "bg-emerald-400/20 text-emerald-300" : ac ? "border border-white/30 softpulse" : "border border-white/12"}`}>{dn ? "✓" : ""}</span><div><div className={`text-sm ${dn ? "text-[var(--text-dim)]" : ac ? "text-[var(--text)]" : "text-[var(--text-mute)]"}`}>{s.t}</div>{ac && s.sub && <div className="mt-0.5 text-xs text-[var(--text-mute)]">{s.sub}</div>}</div></div>); })}</div>
            </div>
          )}
          {phase === "error" && <p className="mt-3 text-sm text-red-300">Couldn&apos;t re-run right now. <button onClick={() => rerun(thesis.idea)} className="underline">Try again</button></p>}
          {phase === "ready" && fresh && (
            <>
              <div className="mt-2 flex items-center justify-between gap-2"><h3 className="text-[15px] font-semibold text-[var(--text)]">The current picture</h3>{fresh.intelligence && <Badge call={fresh.intelligence.decision.call} />}</div>
              <div className="mt-4"><div className="text-[11px] text-[var(--text-mute)]">Base rate · {fresh.stress?.primaryHorizon ?? 5} days {rateDelta != null && Math.abs(rateDelta) >= 1 && <span className={`ml-1 ${rateDelta >= 0 ? "text-emerald-300" : "text-red-300"}`}>{rateDelta >= 0 ? "+" : ""}{fmt(rateDelta, 0)} pts vs then</span>}</div><div className="mt-1 flex items-baseline gap-2"><span className="tnum text-3xl font-semibold text-[var(--text)]">{nowRate != null ? `${fmt(nowRate, 0)}%` : "—"}</span><span className="mono text-xs text-[var(--text-mute)]">n = {fresh.stress?.sampleSize ?? "—"} · {fresh.stress?.confidence ?? "—"}</span></div><RateBar pct={nowRate} muted /></div>
              <div className="mt-5 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-mute)]">Assumptions, re-checked</div>
              <div className="mt-2"><Assump items={fresh.intelligence?.assumptions ?? []} tone="now" /></div>
            </>
          )}
        </div>
      </div>

      {/* what now */}
      {phase === "ready" && fresh && (
        <div className="animate-in mt-4 rounded-2xl border border-[var(--border-2)] bg-[var(--surface)] p-5">
          {!done ? (
            <>
              <h2 className="text-[15px] font-semibold text-[var(--text)]">What now?</h2>
              <p className="mt-1 text-sm text-[var(--text-dim)]">Pick a fresh decision to save an updated thesis and relink this position, or close the position.</p>
              <div className="mt-4 grid gap-2.5 sm:grid-cols-3">
                {(["Trade", "Watch", "Pass"] as const).map((c) => { const on = decision === c; return (
                  <button key={c} onClick={() => setDecision(c)} className={`rounded-xl border py-3 text-center text-sm font-semibold transition ${on ? OPT_SEL[c] : "border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-dim)] hover:text-[var(--text)]"}`}><span className={on ? OPT_COLOR[c] : ""}>{c}</span></button>
                ); })}
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2.5">
                  <button onClick={updateThesis} disabled={!decision} className="rounded-xl bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-[var(--accent-text)] transition hover:bg-[var(--accent-hover)] disabled:opacity-40">Save updated thesis</button>
                  <button onClick={closePosition} className="rounded-xl border border-red-400/40 bg-red-400/[0.08] px-4 py-2.5 text-sm font-medium text-red-300 transition hover:bg-red-400/[0.14]">Close position</button>
                </div>
                <span className="text-xs text-[var(--text-mute)]">Paper position · stored on this device</span>
              </div>
            </>
          ) : (
            <div className="flex flex-wrap items-center gap-3 text-sm"><span className="inline-flex items-center gap-1.5 text-emerald-300"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Updated thesis saved and relinked.</span><Link href={`/theses/${done}`} className="rounded-lg border border-[var(--border-2)] bg-[var(--surface-2)] px-3 py-1.5 text-[var(--text-dim)] transition hover:text-[var(--text)]">View thesis →</Link><Link href="/portfolio" className="text-[var(--text-mute)] transition hover:text-[var(--text)]">Back to Portfolio</Link></div>
          )}
        </div>
      )}

      {phase === "ready" && fresh && <AIAnalysis r={fresh} headerRight={<span className="text-xs text-[var(--text-mute)]">fresh re-run</span>} />}

      <footer className="mt-10 flex flex-col items-start justify-between gap-3 border-t border-[var(--border)] pt-6 text-xs text-[var(--text-mute)] sm:flex-row"><p className="max-w-2xl leading-relaxed">Reckon is for research and education. It isn&apos;t financial advice, and how past setups moved doesn&apos;t guarantee how this one will.</p><span className="shrink-0">Powered by <span className="font-medium text-[var(--text-dim)]">Qwen</span></span></footer>
    </main>
  );
}

function NotFound() {
  return <main className="mx-auto max-w-[760px] px-6 py-16 text-center"><h1 className="text-xl font-semibold text-[var(--text)]">Position not found</h1><p className="mt-2 text-sm text-[var(--text-dim)]">It may have been closed on this device.</p><Link href="/portfolio" className="mt-5 inline-block rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--accent-text)]">Back to Portfolio</Link></main>;
}