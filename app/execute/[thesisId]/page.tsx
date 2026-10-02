"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { thesesStore, portfolioStore, newId } from "@/lib/storage";
import { suggestTicket, ticketRisk, type OrderTicket } from "@/lib/order";
import { fmt, dir, type SavedThesis, type Position } from "@/components/analysis-ui";

const money = (n?: number | null) => (typeof n === "number" && Number.isFinite(n) ? `$${Math.abs(n).toFixed(2)}` : "—");
const dateFmt = (iso: string) => { try { return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }); } catch { return iso; } };

export default function ExecutePage() {
  const params = useParams();
  const id = String(params?.thesisId ?? "");
  const [thesis, setThesis] = useState<SavedThesis | null | undefined>(undefined);
  const [ticket, setTicket] = useState<OrderTicket | null>(null);
  const [copied, setCopied] = useState(false);
  const [executed, setExecuted] = useState<string | null>(null);

  useEffect(() => {
    const t = (thesesStore.get(id) as unknown as SavedThesis) ?? null;
    setThesis(t);
    if (t) {
      const side = t.direction === "short" ? "short" : "long";
      setTicket(suggestTicket(t.ticker, side, t.quote?.price ?? 1));
      fetch(`/api/pulse?symbol=${encodeURIComponent(t.ticker)}`).then((r) => r.json()).then((j) => { if (j?.price != null) setTicket(suggestTicket(t.ticker, side, Number(j.price))); }).catch(() => {});
    }
  }, [id]);

  const risk = useMemo(() => (ticket ? ticketRisk(ticket) : null), [ticket]);

  if (thesis === undefined) return <main className="px-6 py-10 text-sm text-[var(--text-mute)]">Loading…</main>;
  if (thesis === null) return (
    <main className="mx-auto max-w-[760px] px-6 py-16 text-center"><h1 className="text-xl font-semibold text-[var(--text)]">Thesis not found</h1><Link href="/theses" className="mt-5 inline-block rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--accent-text)]">Back to My Theses</Link></main>
  );

  const d = dir[thesis.direction];
  const upd = (k: keyof OrderTicket, v: string) => setTicket((t) => (t ? { ...t, [k]: Number(v) } : t));

  const orderBlock = ticket ? [
    `${ticket.ticker} · ${ticket.side === "long" ? "BUY (long)" : "SELL (short)"}`,
    `Size:      ${ticket.size} shares`,
    `Entry:     $${fmt(ticket.entry)} limit`,
    `Stop-loss: $${fmt(ticket.stop)}`,
    `Target:    $${fmt(ticket.target)}`,
    `From Reckon thesis, ${dateFmt(thesis.createdAt)}`,
  ].join("\n") : "";

  function executeSimulated() {
    if (!ticket || !risk?.valid) return;
    const pos: Position = { id: newId("pos"), createdAt: new Date().toISOString(), ticker: ticket.ticker, side: ticket.side, size: ticket.size, entryPrice: ticket.entry, openedAt: new Date().toISOString(), linkedThesisId: thesis!.id, stop: ticket.stop, target: ticket.target, simulated: true };
    portfolioStore.upsert(pos);
    setExecuted(pos.id);
  }
  async function copyOrder() { try { await navigator.clipboard.writeText(orderBlock); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch { /* ignore */ } }

  return (
    <main className="mx-auto max-w-[980px] px-4 pb-16 pt-8 sm:px-6">
      <div className="flex items-center justify-between gap-3">
        <Link href={`/theses/${thesis.id}`} className="inline-flex items-center gap-1.5 text-sm text-[var(--text-dim)] transition hover:text-[var(--text)]"><span aria-hidden>‹</span> Thesis</Link>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-400/[0.06] px-3 py-1 text-xs font-medium text-amber-200"><svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"><path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /></svg>Simulated / paper</span>
      </div>

      {/* header card */}
      <div className="animate-in mt-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <div className="flex items-center gap-3.5"><span className="mono grid h-11 w-11 place-items-center rounded-xl bg-[var(--surface-2)] text-sm font-medium text-[var(--text-dim)]">{thesis.ticker.slice(0, 2)}</span><div><div className="flex items-center gap-2"><span className="text-lg font-semibold tracking-tight">{thesis.ticker}</span><span className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium ring-1 ring-inset ${d.cls}`}><span aria-hidden>{d.arrow}</span>{d.label}</span></div><div className="text-xs text-[var(--text-dim)]">{thesis.companyName ?? thesis.ticker}</div></div></div>
          <div className="ml-auto flex items-center gap-6 sm:gap-8">
            <div><div className="text-[11px] uppercase tracking-wide text-[var(--text-mute)]">Current price · EOD</div><div className="mono mt-0.5 text-lg text-[var(--text)]">{ticket?.currentPrice ? money(ticket.currentPrice) : "—"}</div></div>
            <div><div className="text-[11px] uppercase tracking-wide text-[var(--text-mute)]">Your decision</div><div className="mt-1 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold text-emerald-300"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />{thesis.decision}</div></div>
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_360px]">
        {/* prepared order */}
        <div className="animate-in rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5" style={{ animationDelay: "40ms" }}>
          <h2 className="text-[15px] font-semibold text-[var(--text)]">Prepared order</h2>
          <p className="mt-1 text-sm text-[var(--text-dim)]">Edit any level. The risk readout updates as you type.</p>
          {ticket && risk && (
            <>
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Field label="Entry" suffix="$" value={ticket.entry} onChange={(v) => upd("entry", v)} />
                <Field label="Stop-loss" suffix="$" value={ticket.stop} onChange={(v) => upd("stop", v)} />
                <Field label="Target" suffix="$" value={ticket.target} onChange={(v) => upd("target", v)} />
                <Field label="Size" suffix="sh" value={ticket.size} onChange={(v) => upd("size", v)} />
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-2)]/50 p-4 sm:grid-cols-4">
                <Read label="Risk to stop" value={`-${money(risk.riskAmount)}`} tone="down" sub={risk.stopDistPct != null ? `${risk.stopDistPct.toFixed(1)}% away` : undefined} />
                <Read label="Reward to target" value={`+${money(risk.rewardAmount)}`} tone="up" />
                <Read label="Reward : risk" value={risk.rr != null ? `${risk.rr.toFixed(2)} R` : "—"} tone={risk.rr != null && risk.rr >= 1.5 ? "up" : "plain"} />
                <Read label="Risk per share" value={money(risk.riskPerShare)} />
              </div>

              <RiskBar entry={ticket.entry} stop={ticket.stop} target={ticket.target} />

              <div className={`mt-3 flex items-center gap-2 text-[13px] ${risk.valid ? "text-emerald-300" : "text-amber-300"}`}>
                {risk.valid ? <><svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4L19 7" /></svg>Levels check out: {ticket.side === "long" ? "stop below entry, target above." : "stop above entry, target below."}</> : <>⚠ {risk.reason}</>}
              </div>

              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] pt-5">
                {!executed ? (
                  <>
                    <span className="text-xs text-[var(--text-mute)]">Records a paper position. No real order is placed.</span>
                    <button onClick={executeSimulated} disabled={!risk.valid} className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-emerald-400 disabled:opacity-40">Execute (simulated) <span aria-hidden>→</span></button>
                  </>
                ) : (
                  <div className="flex flex-wrap items-center gap-3 text-sm"><span className="inline-flex items-center gap-1.5 text-emerald-300"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Paper trade recorded</span><Link href="/portfolio" className="rounded-lg border border-[var(--border-2)] bg-[var(--surface-2)] px-3.5 py-1.5 text-[var(--text)] transition hover:border-white/25">View in Portfolio →</Link></div>
                )}
              </div>
            </>
          )}
        </div>

        {/* bitget handoff */}
        <div className="animate-in rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5" style={{ animationDelay: "80ms" }}>
          <h2 className="text-[15px] font-semibold text-[var(--text)]">Take it to Bitget</h2>
          <p className="mt-1 text-sm leading-relaxed text-[var(--text-dim)]">Copy the plan, then enter it in Bitget yourself. There&apos;s no pre-filled order link.</p>
          <pre className="mono mt-3 overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--surface-2)]/60 p-4 text-[12px] leading-relaxed text-[var(--text-dim)]">{orderBlock}</pre>
          <div className="mt-3 flex flex-wrap items-center gap-2.5">
            <button onClick={copyOrder} className="rounded-xl border border-[var(--border-2)] bg-[var(--surface-2)] px-4 py-2 text-sm font-medium text-[var(--text)] transition hover:border-white/25">{copied ? "Copied ✓" : "Copy order details"}</button>
            <a href="https://www.bitget.com/" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--accent-text)] transition hover:bg-[var(--accent-hover)]">Open Bitget <span aria-hidden>↗</span></a>
          </div>
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-2)]/40 p-3 text-[11px] leading-relaxed text-[var(--text-mute)]"><svg viewBox="0 0 24 24" className="mt-0.5 h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M6 10V7a6 6 0 1 1 12 0v3M5 10h14v10H5z" /></svg>Reckon never holds your keys or places the order. This is a handoff only.</div>
        </div>
      </div>

      <footer className="mt-10 flex flex-col items-start justify-between gap-3 border-t border-[var(--border)] pt-6 text-xs text-[var(--text-mute)] sm:flex-row"><p className="max-w-2xl leading-relaxed">Reckon is for research and education. It isn&apos;t financial advice, and how past setups moved doesn&apos;t guarantee how this one will.</p><span className="shrink-0">Powered by <span className="font-medium text-[var(--text-dim)]">Qwen</span></span></footer>
    </main>
  );
}

function Field({ label, value, onChange, suffix }: { label: string; value: number; onChange: (v: string) => void; suffix?: string }) {
  return (
    <div>
      <label className="block text-[11px] text-[var(--text-mute)]">{label}</label>
      <div className="mt-1.5 flex items-center rounded-xl border border-[var(--border)] bg-[var(--surface-2)] pr-2.5 focus-within:border-[var(--border-2)]">
        <input value={Number.isFinite(value) ? value : ""} onChange={(e) => onChange(e.target.value)} inputMode="decimal" className="mono w-full bg-transparent px-3 py-2 text-sm text-[var(--text)] outline-none" />
        {suffix && <span className="mono shrink-0 text-xs text-[var(--text-mute)]">{suffix}</span>}
      </div>
    </div>
  );
}
function Read({ label, value, tone = "plain", sub }: { label: string; value: string; tone?: "up" | "down" | "plain"; sub?: string }) {
  const c = tone === "up" ? "text-emerald-300" : tone === "down" ? "text-red-300" : "text-[var(--text)]";
  return <div><div className="text-[11px] text-[var(--text-mute)]">{label}</div><div className={`mono mt-0.5 text-sm font-medium ${c}`}>{value}</div>{sub && <div className="text-[10px] text-[var(--text-mute)]">{sub}</div>}</div>;
}
function RiskBar({ entry, stop, target }: { entry: number; stop: number; target: number }) {
  const dmin = Math.min(entry, stop, target), dmax = Math.max(entry, stop, target);
  const span = dmax - dmin || 1;
  const x = (v: number) => ((v - dmin) / span) * 100;
  const redL = Math.min(entry, stop), redR = Math.max(entry, stop);
  const grL = Math.min(entry, target), grR = Math.max(entry, target);
  return (
    <div className="mt-5">
      <div className="relative h-2 rounded-full bg-white/[0.05]">
        <div className="absolute inset-y-0 rounded-full bg-red-400/70" style={{ left: `${x(redL)}%`, width: `${x(redR) - x(redL)}%` }} />
        <div className="absolute inset-y-0 rounded-full bg-emerald-400/70" style={{ left: `${x(grL)}%`, width: `${x(grR) - x(grL)}%` }} />
        <div className="absolute -top-1 -bottom-1 w-px bg-white/50" style={{ left: `${x(entry)}%` }} />
      </div>
      <div className="mono relative mt-1.5 h-4 text-[11px] text-[var(--text-mute)]">
        <span className="absolute -translate-x-1/2 whitespace-nowrap" style={{ left: `${x(stop)}%` }}>stop ${stop.toFixed(2)}</span>
        <span className="absolute -translate-x-1/2 whitespace-nowrap text-[var(--text-dim)]" style={{ left: `${x(entry)}%` }}>entry ${entry.toFixed(2)}</span>
        <span className="absolute -translate-x-1/2 whitespace-nowrap" style={{ left: `${x(target)}%` }}>target ${target.toFixed(2)}</span>
      </div>
    </div>
  );
}