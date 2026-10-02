"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import PriceChart from "@/components/price-chart";

type Pulse = {
  ok?: boolean; notFound?: boolean; symbol: string; name?: string;
  price?: number | null; asOf?: string | null; changePct?: number | null;
  change5dPct?: number | null; change30dPct?: number | null; low52?: number | null; high52?: number | null;
  history?: { date: string; close: number }[]; suggestion?: { symbol: string; name: string } | null; error?: string;
};

const fmt = (n?: number | null, dp = 2) => (typeof n === "number" && Number.isFinite(n) ? n.toFixed(dp) : "—");
const pctf = (n?: number | null, dp = 1) => (typeof n === "number" && Number.isFinite(n) ? `${n >= 0 ? "+" : ""}${n.toFixed(dp)}%` : "—");
const shortDate = (d: string) => { try { return new Date(d + "T00:00:00Z").toLocaleDateString(undefined, { month: "short", day: "numeric" }); } catch { return d; } };
const longDate = (d?: string | null) => { if (!d) return ""; try { return new Date(d + "T00:00:00Z").toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }); } catch { return d; } };

const POPULAR = [
  { t: "NVDA", n: "NVIDIA Corp" }, { t: "AAPL", n: "Apple Inc." }, { t: "TSLA", n: "Tesla, Inc." },
  { t: "AMD", n: "Advanced Micro Devices" }, { t: "MSFT", n: "Microsoft Corp" }, { t: "AMZN", n: "Amazon.com, Inc." },
];

type Phase = "idle" | "loading" | "ok" | "notfound" | "error";

export default function DiscoverPage() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [pulse, setPulse] = useState<Pulse | null>(null);

  async function search(sym?: string) {
    const symbol = (sym ?? q).trim().toUpperCase();
    if (!symbol) return;
    if (sym) setQ(sym);
    setPhase("loading"); setPulse(null);
    try {
      const res = await fetch(`/api/pulse?symbol=${encodeURIComponent(symbol)}`);
      const json: Pulse = await res.json();
      if (res.status === 404 && json.notFound) { setPulse(json); setPhase("notfound"); }
      else if (!res.ok) { setPulse({ symbol, error: json.error }); setPhase("error"); }
      else { setPulse(json); setPhase("ok"); }
    } catch { setPulse({ symbol }); setPhase("error"); }
  }

  return (
    <main className="mx-auto max-w-[1240px] px-4 py-6 sm:px-6 sm:py-8">
      <h1 className="text-2xl font-semibold tracking-tight text-[var(--text)]">Discover</h1>
      <p className="mt-2 text-sm text-[var(--text-dim)]">Look up one US stock, check its pulse, then open full research.</p>

      <div className="mt-6 flex items-center gap-3">
        <div className="relative flex flex-1 items-center">
          <svg viewBox="0 0 24 24" className="pointer-events-none absolute left-4 h-4 w-4 text-[var(--text-mute)]" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4-4" strokeLinecap="round" /></svg>
          <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && search()} placeholder="Ticker symbol, e.g. NVDA" className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] py-3 pl-11 pr-4 text-[15px] uppercase text-[var(--text)] outline-none transition-colors focus:border-[var(--border-2)] placeholder:normal-case placeholder:text-[var(--text-mute)]" />
        </div>
        <button onClick={() => search()} disabled={!q.trim()} className="rounded-xl bg-[var(--accent)] px-6 py-3 text-sm font-semibold text-[var(--accent-text)] transition hover:bg-[var(--accent-hover)] disabled:opacity-40">Search</button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-xs text-[var(--text-mute)]">Popular</span>
        {POPULAR.map((p) => <button key={p.t} onClick={() => search(p.t)} className="mono rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1 text-xs text-[var(--text-dim)] transition hover:border-[var(--border-2)] hover:text-[var(--text)]">{p.t}</button>)}
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_320px]">
        {/* left: pulse / states */}
        <div>
          {phase === "idle" && <IdleCard />}
          {phase === "loading" && <LoadingCard />}
          {phase === "notfound" && pulse && <NotFoundCard pulse={pulse} onPick={(s) => search(s)} />}
          {phase === "error" && pulse && <ErrorCard onRetry={() => search(pulse.symbol)} />}
          {phase === "ok" && pulse?.ok && <PulseCard pulse={pulse} onOpen={() => router.push(`/research?symbol=${encodeURIComponent(pulse.symbol)}`)} />}
        </div>

        {/* right: popular list */}
        <div className="animate-in rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-2" style={{ animationDelay: "60ms" }}>
          <div className="px-3 py-2 text-sm font-semibold text-[var(--text)]">Popular</div>
          <div className="space-y-0.5">
            {POPULAR.map((p, i) => (
              <button key={p.t} onClick={() => search(p.t)} className="group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-[var(--surface-2)]">
                <span className="mono w-3 shrink-0 text-xs text-[var(--text-mute)]">{i + 1}</span>
                <div className="min-w-0 flex-1"><div className="text-sm font-semibold text-[var(--text)]">{p.t}</div><div className="truncate text-xs text-[var(--text-mute)]">{p.n}</div></div>
                <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-[var(--text-mute)] transition group-hover:text-[var(--text-dim)]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>
              </button>
            ))}
          </div>
        </div>
      </div>

      <footer className="mt-10 flex flex-col items-start justify-between gap-3 border-t border-[var(--border)] pt-6 text-xs text-[var(--text-mute)] sm:flex-row">
        <p className="max-w-2xl leading-relaxed">Reckon is for research and education. It isn&apos;t financial advice, and how past setups moved doesn&apos;t guarantee how this one will.</p>
        <span className="shrink-0">Powered by <span className="font-medium text-[var(--text-dim)]">Qwen</span></span>
      </footer>
    </main>
  );
}

function PulseCard({ pulse, onOpen }: { pulse: Pulse; onOpen: () => void }) {
  const up = (pulse.changePct ?? 0) >= 0;
  const history = pulse.history ?? [];
  const closes = history.map((h) => h.close);
  const axis = history.length > 1 ? [0, 0.25, 0.5, 0.75, 1].map((f) => shortDate(history[Math.round(f * (history.length - 1))].date)) : [];
  // end-price pill vertical position
  let endTop = 50;
  if (closes.length > 1) { const mn = Math.min(...closes), mx = Math.max(...closes); const last = closes[closes.length - 1]; endTop = Math.max(6, Math.min(86, (1 - (last - mn) / (mx - mn || 1)) * 100)); }

  return (
    <div className="animate-in rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3.5">
          <span className="mono grid h-11 w-11 place-items-center rounded-xl bg-[var(--surface-2)] text-sm font-medium text-[var(--text-dim)]">{pulse.symbol.slice(0, 2)}</span>
          <div><div className="text-lg font-semibold tracking-tight text-[var(--text)]">{pulse.symbol}</div><div className="text-xs text-[var(--text-dim)]">{pulse.name ?? pulse.symbol}</div></div>
        </div>
        <div className="text-right">
          <div className="mono text-2xl font-semibold text-[var(--text)]">{pulse.price != null ? `$${fmt(pulse.price)}` : "—"}</div>
          <div className={`mono text-sm ${up ? "text-emerald-300" : "text-red-300"}`}><span aria-hidden>{up ? "▲" : "▼"}</span> {pctf(pulse.changePct)} <span className="text-[var(--text-mute)]">last session</span></div>
        </div>
      </div>

      <div className="relative mt-5">
        <PriceChart closes={closes} height={180} />
        {closes.length > 1 && pulse.price != null && (
          <span className="mono absolute right-1 rounded-md bg-emerald-500/90 px-1.5 py-0.5 text-[11px] font-medium text-black" style={{ top: `${endTop}%` }}>${fmt(pulse.price)}</span>
        )}
      </div>
      {axis.length > 0 && <div className="mono mt-2 flex justify-between text-[11px] text-[var(--text-mute)]">{axis.map((d, i) => <span key={i}>{d}</span>)}</div>}

      <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <Mini label="5-day" value={pctf(pulse.change5dPct)} tone={pulse.change5dPct} />
        <Mini label="30-day" value={pctf(pulse.change30dPct)} tone={pulse.change30dPct} />
        <Mini label="52-week low" value={pulse.low52 != null ? `$${fmt(pulse.low52)}` : "—"} />
        <Mini label="52-week high" value={pulse.high52 != null ? `$${fmt(pulse.high52)}` : "—"} />
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] pt-4">
        <span className="text-xs text-[var(--text-mute)]">{pulse.asOf ? `As of ${longDate(pulse.asOf)} · EOD close, not real-time` : "EOD close, not real-time"}</span>
        <button onClick={onOpen} className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--accent-text)] transition hover:bg-[var(--accent-hover)]">Open full research <span aria-hidden>→</span></button>
      </div>
    </div>
  );
}

function Mini({ label, value, tone }: { label: string; value: string; tone?: number | null }) {
  const c = typeof tone === "number" ? (tone >= 0 ? "text-emerald-300" : "text-red-300") : "text-[var(--text)]";
  return <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)]/50 px-3 py-2.5"><div className="text-[11px] text-[var(--text-mute)]">{label}</div><div className={`mono mt-0.5 text-sm font-medium ${c}`}>{value}</div></div>;
}

function IdleCard() {
  return (
    <div className="animate-in rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
      <span className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--surface-2)] text-[var(--text-mute)]"><svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4-4" strokeLinecap="round" /></svg></span>
      <h2 className="mt-4 text-base font-semibold text-[var(--text)]">Search a US stock</h2>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-[var(--text-dim)]">Type a ticker or tap a popular pick to see its price, trend and 52-week range.</p>
    </div>
  );
}
function LoadingCard() {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
      <div className="flex items-center gap-3.5"><div className="skeleton h-11 w-11 rounded-xl bg-[var(--surface-2)]" /><div className="skeleton h-4 w-40 rounded bg-[var(--surface-2)]" /></div>
      <div className="skeleton mt-6 h-40 rounded-xl bg-[var(--surface-2)]" />
      <div className="mt-4 grid grid-cols-4 gap-2.5">{[0, 1, 2, 3].map((i) => <div key={i} className="skeleton h-14 rounded-xl bg-[var(--surface-2)]" />)}</div>
    </div>
  );
}
function NotFoundCard({ pulse, onPick }: { pulse: Pulse; onPick: (s: string) => void }) {
  return (
    <div className="animate-in rounded-2xl border border-amber-400/25 bg-amber-400/[0.05] p-6">
      <span className="grid h-10 w-10 place-items-center rounded-xl bg-amber-400/12 text-amber-300"><svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"><path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /></svg></span>
      <h2 className="mt-4 text-base font-semibold text-[var(--text)]">No US stock called <span className="mono text-amber-300">{pulse.symbol}</span></h2>
      <p className="mt-2 text-sm text-[var(--text-dim)]">Check the symbol and try again.</p>
      {pulse.suggestion && (
        <div className="mt-4 flex items-center gap-2 text-xs text-[var(--text-mute)]">Did you mean
          <button onClick={() => onPick(pulse.suggestion!.symbol)} className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-2)] bg-[var(--surface-2)] px-2.5 py-1 transition hover:border-white/25"><span className="mono font-medium text-[var(--text)]">{pulse.suggestion.symbol}</span><span className="text-[var(--text-dim)]">· {pulse.suggestion.name}</span></button>
        </div>
      )}
    </div>
  );
}
function ErrorCard({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="animate-in rounded-2xl border border-red-400/25 bg-red-400/[0.05] p-6">
      <span className="grid h-10 w-10 place-items-center rounded-xl bg-red-400/12 text-red-300"><svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" /><path d="M15 9l-6 6M9 9l6 6" strokeLinecap="round" /></svg></span>
      <h2 className="mt-4 text-base font-semibold text-[var(--text)]">Couldn&apos;t load prices</h2>
      <p className="mt-2 text-sm text-[var(--text-dim)]">The price source didn&apos;t respond. Check your connection and retry.</p>
      <button onClick={onRetry} className="mt-4 rounded-xl border border-[var(--border-2)] bg-[var(--surface-2)] px-4 py-2 text-sm font-medium text-[var(--text)] transition hover:border-white/25">Try again</button>
    </div>
  );
}