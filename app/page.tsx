"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { profileStore, thesesStore, portfolioStore } from "@/lib/storage";

const LOOP = [
  { href: "/discover", n: "01", t: "Discover & research", d: "Look up a stock, then turn your idea into a full brief." },
  { href: "/research", n: "02", t: "Stress-test the thesis", d: "See the case against you and how similar setups really moved." },
  { href: "/research", n: "03", t: "Decide", d: "Trade, Watch or Pass. The AI suggests; you make the call." },
  { href: "/portfolio", n: "04", t: "Track", d: "Paper positions that flag you when the story changes." },
];

function ArrowCircle() {
  return (
    <span className="grid h-8 w-8 place-items-center rounded-full border border-[var(--border-2)] text-[var(--text-dim)] transition group-hover:border-[var(--accent)] group-hover:text-[var(--text)]">
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
    </span>
  );
}

export default function Home() {
  const [name, setName] = useState<string | null>(null);
  const [counts, setCounts] = useState({ theses: 0, positions: 0 });

  useEffect(() => {
    setName(profileStore.get()?.name ?? null);
    setCounts({ theses: thesesStore.list().length, positions: portfolioStore.list().length });
  }, []);

  return (
    <main className="mx-auto max-w-[1240px] px-4 py-6 sm:px-6 sm:py-8">
      {/* hero + snapshot */}
      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        {/* hero card */}
        <div className="animate-in rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 sm:p-8">
          <div className="grid gap-8 md:grid-cols-[1fr_290px]">
            <div className="flex flex-col justify-between">
              <div>
                <p className="text-sm text-[var(--text-dim)]">{name ? `Welcome back, ${name}.` : "Welcome to Reckon."}</p>
                <h1 className="mt-3 text-3xl font-semibold leading-[1.08] tracking-tight text-[var(--text)] sm:text-[42px]">
                  Challenge the trade<br />before you place it.
                </h1>
                <p className="mt-4 max-w-md text-[15px] leading-relaxed text-[var(--text-dim)]">
                  Reckon is your research cockpit for US stocks. Describe an idea, and it checks the filings, the history and the case against you.
                </p>
              </div>
              <div className="mt-7 flex flex-wrap gap-2.5">
                <Link href="/research" className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-[var(--accent-text)] transition hover:bg-[var(--accent-hover)]">Start a research brief <span aria-hidden>→</span></Link>
                <Link href="/theses" className="rounded-xl border border-[var(--border-2)] bg-[var(--surface-2)] px-5 py-2.5 text-sm font-medium text-[var(--text-dim)] transition hover:text-[var(--text)]">My theses</Link>
              </div>
            </div>

            {/* example brief */}
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)]/60 p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-[var(--text-mute)]">Example brief</span>
                <span className="mono inline-flex items-center gap-1 rounded-md bg-emerald-400/12 px-1.5 py-0.5 text-[10px] font-medium text-emerald-300"><span aria-hidden>↗</span>LONG</span>
              </div>
              <div className="mt-3 text-lg font-semibold tracking-tight text-[var(--text)]">NVDA</div>
              <div className="tnum mt-2 text-5xl font-semibold leading-none text-emerald-400">65%</div>
              <p className="mt-2 text-sm text-[var(--text-dim)]">of 20 similar setups worked in 5 days</p>
              <div className="mt-4 relative h-1.5 rounded-full bg-white/[0.06]">
                <div className="h-full rounded-full bg-emerald-400" style={{ width: "65%" }} />
                <div className="absolute -top-1 -bottom-1 left-1/2 w-px bg-white/25" />
              </div>
              <div className="mt-5 flex items-center justify-between border-t border-[var(--border)] pt-3">
                <span className="text-xs text-[var(--text-mute)]">AI suggests</span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-400/12 px-2.5 py-1 text-xs font-semibold text-amber-300"><span className="h-1.5 w-1.5 rounded-full bg-amber-400" />Watch</span>
              </div>
            </div>
          </div>
        </div>

        {/* snapshot */}
        <div className="animate-in rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6" style={{ animationDelay: "60ms" }}>
          <h2 className="text-[15px] font-semibold text-[var(--text)]">Your snapshot</h2>
          <div className="mt-4 space-y-1">
            <SnapRow href="/theses" n="1" title="Saved theses" sub="Committed decisions" value={counts.theses} />
            <SnapRow href="/portfolio" n="2" title="Open positions" sub="Paper, tracked live" value={counts.positions} />
            <SnapRow href="/history" n="3" title="History entries" sub="Your decision trail" value={counts.theses} />
          </div>
          <div className="mt-5 flex items-center gap-1.5 border-t border-[var(--border)] pt-4 text-xs text-[var(--text-mute)]">
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M6 10V7a6 6 0 1 1 12 0v3M5 10h14v10H5z" /></svg>
            Stored on this device only
          </div>
        </div>
      </div>

      {/* the loop */}
      <div className="mt-9 flex items-center justify-between">
        <h2 className="text-xl font-semibold tracking-tight text-[var(--text)]">The loop</h2>
        <Link href="/history" className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-2)] bg-[var(--surface-2)] px-3.5 py-1.5 text-sm text-[var(--text-dim)] transition hover:text-[var(--text)]">View history <span aria-hidden>→</span></Link>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {LOOP.map((s, i) => (
          <Link key={s.n + s.t} href={s.href} className="animate-in group flex flex-col rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 transition hover:border-[var(--border-2)]" style={{ animationDelay: `${120 + i * 60}ms` }}>
            <div className="flex items-start justify-between">
              <span className="mono text-xs text-[var(--text-mute)]">{s.n}</span>
              <ArrowCircle />
            </div>
            <div className="mt-8 text-base font-semibold text-[var(--text)]">{s.t}</div>
            <p className="mt-2 text-[13px] leading-relaxed text-[var(--text-dim)]">{s.d}</p>
          </Link>
        ))}
      </div>

      <footer className="mt-10 flex flex-col items-start justify-between gap-3 border-t border-[var(--border)] pt-6 text-xs text-[var(--text-mute)] sm:flex-row">
        <p className="max-w-2xl leading-relaxed">Reckon is for research and education. It isn&apos;t financial advice, and how past setups moved doesn&apos;t guarantee how this one will.</p>
        <span className="shrink-0">Powered by <span className="font-medium text-[var(--text-dim)]">Qwen</span></span>
      </footer>
    </main>
  );
}

function SnapRow({ href, n, title, sub, value }: { href: string; n: string; title: string; sub: string; value: number }) {
  return (
    <Link href={href} className="group flex items-center gap-3 rounded-xl px-2 py-2.5 transition hover:bg-[var(--surface-2)]">
      <span className="mono text-xs text-[var(--text-mute)]">{n}</span>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-[var(--text)]">{title}</div>
        <div className="text-xs text-[var(--text-mute)]">{sub}</div>
      </div>
      <span className="tnum text-xl font-semibold text-[var(--text)]">{value}</span>
    </Link>
  );
}