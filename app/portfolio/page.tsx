"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { portfolioStore, thesesStore } from "@/lib/storage";
import { positionPnl, computeReviewSignals, type ReviewSignal } from "@/lib/portfolio";
import { dir, type Position, type SavedThesis } from "@/components/analysis-ui";
import AddPosition from "@/components/add-position";
import EmptyState from "@/components/empty-state";

type Live = { price: number | null; latestFilingDate: string | null };
const fmt = (n?: number | null, dp = 2) => (typeof n === "number" && Number.isFinite(n) ? n.toFixed(dp) : "—");
const money = (n?: number | null) => (typeof n === "number" && Number.isFinite(n) ? `${n >= 0 ? "+" : "-"}$${Math.abs(n).toFixed(2)}` : "—");
const pctf = (n?: number | null) => (typeof n === "number" && Number.isFinite(n) ? `${n >= 0 ? "+" : ""}${n.toFixed(1)}%` : "—");
const OPT_COLOR: Record<string, string> = { Trade: "text-emerald-300", Watch: "text-amber-300", Pass: "text-red-300" };
const OPT_DOT: Record<string, string> = { Trade: "bg-emerald-400", Watch: "bg-amber-400", Pass: "bg-red-400" };

export default function PortfolioPage() {
  const [positions, setPositions] = useState<Position[] | null>(null);
  const [live, setLive] = useState<Record<string, Live>>({});
  const [theses, setTheses] = useState<Record<string, SavedThesis>>({});
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    const pos = portfolioStore.list() as unknown as Position[];
    setPositions(pos);
    const tmap: Record<string, SavedThesis> = {};
    for (const p of pos) if (p.linkedThesisId) { const t = thesesStore.get(p.linkedThesisId) as unknown as SavedThesis | null; if (t) tmap[p.linkedThesisId] = t; }
    setTheses(tmap);
    const tickers = Array.from(new Set(pos.map((p) => p.ticker)));
    const results = await Promise.all(tickers.map(async (t) => {
      try { const r = await fetch(`/api/review-check?symbol=${encodeURIComponent(t)}`); const j = await r.json(); return [t, { price: j.price ?? null, latestFilingDate: j.latestFilingDate ?? null }] as const; }
      catch { return [t, { price: null, latestFilingDate: null }] as const; }
    }));
    setLive(Object.fromEntries(results));
  }, []);

  useEffect(() => { load(); }, [load]);
  function close(id: string) { portfolioStore.remove(id); load(); }

  if (positions === null) return <main className="px-6 py-10 text-sm text-[var(--text-mute)]">Loading…</main>;

  const totalPnl = positions.reduce((a, p) => a + (positionPnl(p, live[p.ticker]?.price ?? null).abs ?? 0), 0);
  const totalCost = positions.reduce((a, p) => a + p.entryPrice * p.size, 0);
  const totalPct = totalCost > 0 ? (totalPnl / totalCost) * 100 : null;
  const needsReviewCount = positions.filter((p) => p.linkedThesisId && live[p.ticker] && computeReviewSignals(p, theses[p.linkedThesisId!] ?? null, live[p.ticker].price, live[p.ticker].latestFilingDate).length > 0).length;

  return (
    <main className="mx-auto max-w-[1080px] px-6 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--text)]">Portfolio</h1>
          <p className="mt-2 text-sm text-[var(--text-dim)]">Paper positions tracked against live EOD prices. Stored on this device.</p>
        </div>
        <button onClick={() => setAdding(true)} className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--accent-text)] transition hover:bg-[var(--accent-hover)]"><span className="text-base leading-none">+</span> Add position</button>
      </div>

      {positions.length === 0 ? (
        <EmptyState icon={<svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7h18v13H3zM8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>} title="No positions yet" body="Commit a Trade decision on a thesis and add it here, or add a position manually to track P&L and review alerts." ctaHref="/theses" ctaLabel="Go to My Theses" />
      ) : (
        <>
          <div className="mt-6 grid grid-cols-3 gap-3">
            <Tile label="Open positions" value={String(positions.length)} />
            <Tile label="Total P&amp;L" value={money(totalPnl)} tone={totalPnl >= 0 ? "up" : "down"} sub="paper" mono />
            <Tile label="Return" value={pctf(totalPct)} tone={(totalPct ?? 0) >= 0 ? "up" : "down"} sub={`on $${totalCost.toLocaleString(undefined, { maximumFractionDigits: 0 })} at entry`} mono />
          </div>

          <div className="mt-6 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5"><h2 className="text-[15px] font-semibold text-[var(--text)]">Open positions</h2>{needsReviewCount > 0 && <span className="rounded-full bg-amber-400/12 px-2 py-0.5 text-[11px] font-medium text-amber-300">{needsReviewCount} needs review</span>}</div>
            <span className="text-xs text-[var(--text-mute)]">Simulated · no real orders</span>
          </div>

          <div className="mt-3 space-y-3">
            {positions.map((p) => {
              const l = live[p.ticker];
              const { abs, pct } = positionPnl(p, l?.price ?? null);
              const thesis = p.linkedThesisId ? theses[p.linkedThesisId] : null;
              const signals: ReviewSignal[] = l ? computeReviewSignals(p, thesis ?? null, l.price, l.latestFilingDate) : [];
              const needsReview = signals.length > 0 && !!p.linkedThesisId;
              const sd = dir[p.side === "short" ? "short" : "long"];
              return (
                <div key={p.id} className={`overflow-hidden rounded-2xl border bg-[var(--surface)] ${needsReview ? "border-amber-400/35" : "border-[var(--border)]"}`}>
                  <div className="flex flex-wrap items-center gap-x-6 gap-y-3 p-4">
                    <div className="flex items-center gap-3">
                      <span className="mono grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--surface-2)] text-xs font-medium text-[var(--text-dim)]">{p.ticker.slice(0, 2)}</span>
                      <div><div className="flex items-center gap-1.5"><span className="text-sm font-semibold text-[var(--text)]">{p.ticker}</span><span className={`mono rounded px-1 py-0.5 text-[10px] font-medium ${sd.cls}`}>{sd.label}</span></div></div>
                    </div>
                    <Col label="Size @ entry" value={`${p.size} @ $${fmt(p.entryPrice)}`} />
                    <Col label="Current" value={l?.price != null ? `$${fmt(l.price)}` : "—"} />
                    <Col label="P&L" value={<span className={`${(abs ?? 0) >= 0 ? "text-emerald-300" : "text-red-300"}`}>{money(abs)} <span className="text-xs opacity-80">{pctf(pct)}</span></span>} />
                    <div className="min-w-[180px] flex-1">
                      <div className="text-[11px] text-[var(--text-mute)]">Linked thesis</div>
                      {thesis ? (
                        <Link href={`/theses/${thesis.id}`} className="group mt-0.5 flex items-center gap-2"><span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${OPT_COLOR[thesis.decision]}`}><span className={`h-1.5 w-1.5 rounded-full ${OPT_DOT[thesis.decision]}`} />{thesis.decision}</span><span className="truncate text-xs text-[var(--text-dim)] group-hover:text-[var(--text)]">{thesis.thesis}</span></Link>
                      ) : <div className="mt-0.5 text-xs text-[var(--text-mute)]">No linked thesis</div>}
                    </div>
                    <button onClick={() => close(p.id)} className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3.5 py-1.5 text-sm text-[var(--text-dim)] transition hover:border-red-400/40 hover:text-red-300">Close</button>
                  </div>

                  {needsReview && (
                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-amber-400/20 bg-amber-400/[0.05] px-4 py-3">
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                        <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-amber-200"><span aria-hidden>⚠️</span> Your thesis may need review</span>
                        {signals.map((s, i) => <span key={i} className="rounded-full border border-amber-400/25 bg-amber-400/[0.08] px-2.5 py-0.5 text-[11px] text-amber-200/90">{s.label}</span>)}
                      </div>
                      <Link href={`/portfolio/review/${p.id}`} className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-amber-400/90 px-3.5 py-1.5 text-xs font-semibold text-black transition hover:bg-amber-400">Review thesis <span aria-hidden>→</span></Link>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      <AddPosition open={adding} onClose={() => setAdding(false)} onAdded={load} />

      <footer className="mt-10 flex flex-col items-start justify-between gap-3 border-t border-[var(--border)] pt-6 text-xs text-[var(--text-mute)] sm:flex-row"><p className="max-w-2xl leading-relaxed">Reckon is for research and education. It isn&apos;t financial advice, and how past setups moved doesn&apos;t guarantee how this one will.</p><span className="shrink-0">Powered by <span className="font-medium text-[var(--text-dim)]">Qwen</span></span></footer>
    </main>
  );
}

function Tile({ label, value, tone, sub, mono }: { label: string; value: string; tone?: "up" | "down"; sub?: string; mono?: boolean }) {
  const c = tone === "up" ? "text-emerald-300" : tone === "down" ? "text-red-300" : "text-[var(--text)]";
  return <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4"><div className="text-xs text-[var(--text-mute)]">{label}</div><div className={`mt-1 text-2xl font-semibold ${c} ${mono ? "mono tnum" : ""}`}>{value}</div>{sub && <div className="mt-0.5 text-[11px] text-[var(--text-mute)]">{sub}</div>}</div>;
}
function Col({ label, value }: { label: string; value: React.ReactNode }) {
  return <div><div className="text-[11px] text-[var(--text-mute)]">{label}</div><div className="mono mt-0.5 text-sm font-medium text-[var(--text)]">{value}</div></div>;
}