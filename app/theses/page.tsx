"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { thesesStore } from "@/lib/storage";
import { dir, type SavedThesis } from "@/components/analysis-ui";
import EmptyState from "@/components/empty-state";

const fmtDate = (iso: string) => { try { return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "2-digit", year: "numeric" }); } catch { return iso; } };
const OPT_COLOR: Record<string, string> = { Trade: "text-emerald-300", Watch: "text-amber-300", Pass: "text-red-300" };
const OPT_DOT: Record<string, string> = { Trade: "bg-emerald-400", Watch: "bg-amber-400", Pass: "bg-red-400" };
type Filter = "all" | "Trade" | "Watch" | "Pass";

export default function ThesesPage() {
  const [items, setItems] = useState<SavedThesis[] | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  useEffect(() => { setItems(thesesStore.list() as unknown as SavedThesis[]); }, []);
  function del(e: React.MouseEvent, id: string) { e.preventDefault(); e.stopPropagation(); thesesStore.remove(id); setItems(thesesStore.list() as unknown as SavedThesis[]); }

  if (items === null) return <main className="px-6 py-10 text-sm text-[var(--text-mute)]">Loading…</main>;
  const counts = { all: items.length, Trade: items.filter((t) => t.decision === "Trade").length, Watch: items.filter((t) => t.decision === "Watch").length, Pass: items.filter((t) => t.decision === "Pass").length };
  const shown = filter === "all" ? items : items.filter((t) => t.decision === filter);
  const TABS: [Filter, string][] = [["all", "All"], ["Trade", "Trade"], ["Watch", "Watch"], ["Pass", "Pass"]];

  return (
    <main className="mx-auto max-w-[1080px] px-6 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-2xl font-semibold tracking-tight text-[var(--text)]">My theses</h1><p className="mt-2 text-sm text-[var(--text-dim)]">Your committed decisions. Stored on this device only.</p></div>
        <Link href="/research" className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--accent-text)] transition hover:bg-[var(--accent-hover)]"><span className="text-base leading-none">+</span> New research</Link>
      </div>

      {items.length === 0 ? (
        <EmptyState icon={<svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3h9l3 3v15l-6-3-6 3V3zM9 8h6M9 12h6" /></svg>} title="No theses yet" body="Research an idea and commit a decision. It will be saved here, on this device." ctaHref="/research" ctaLabel="Start research" />
      ) : (
        <div className="mt-6 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-2">
          <div className="flex flex-wrap items-center gap-1.5 p-2">
            {TABS.map(([k, label]) => (
              <button key={k} onClick={() => setFilter(k)} className={`rounded-full px-3 py-1 text-sm font-medium transition ${filter === k ? "bg-[var(--text)] text-[var(--bg)]" : "text-[var(--text-dim)] hover:text-[var(--text)]"}`}>{label} {counts[k]}</button>
            ))}
          </div>
          <div>
            {shown.map((t, i) => {
              const d = dir[t.direction];
              return (
                <div key={t.id} className="group relative flex items-center gap-4 rounded-xl px-3 py-3 transition hover:bg-[var(--surface-2)]">
                  <Link href={`/theses/${t.id}`} className="absolute inset-0" aria-label={`Open ${t.ticker} thesis`} />
                  <span className="mono w-4 shrink-0 text-xs text-[var(--text-mute)]">{i + 1}</span>
                  <span className="mono grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[var(--surface-2)] text-[11px] font-medium text-[var(--text-dim)]">{t.ticker.slice(0, 2)}</span>
                  <div className="flex w-[112px] shrink-0 items-center gap-1.5"><span className="text-sm font-semibold text-[var(--text)]">{t.ticker}</span><span className={`mono rounded px-1 py-0.5 text-[10px] font-medium ${d.cls}`}>{d.label}</span></div>
                  <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${OPT_COLOR[t.decision]}`}><span className={`h-1.5 w-1.5 rounded-full ${OPT_DOT[t.decision]}`} />{t.decision}</span>
                  <span className="min-w-0 flex-1 truncate text-sm text-[var(--text-dim)]">{t.thesis}</span>
                  <span className="mono shrink-0 text-xs text-[var(--text-mute)]">{fmtDate(t.createdAt)}</span>
                  <button onClick={(e) => del(e, t.id)} aria-label="Delete" className="relative z-10 grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-mute)] transition hover:border-red-400/40 hover:text-red-300"><svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" /></svg></button>
                </div>
              );
            })}
            {shown.length === 0 && <p className="px-3 py-8 text-center text-sm text-[var(--text-mute)]">No {filter} theses.</p>}
          </div>
        </div>
      )}

      <footer className="mt-10 flex flex-col items-start justify-between gap-3 border-t border-[var(--border)] pt-6 text-xs text-[var(--text-mute)] sm:flex-row"><p className="max-w-2xl leading-relaxed">Reckon is for research and education. It isn&apos;t financial advice, and how past setups moved doesn&apos;t guarantee how this one will.</p><span className="shrink-0">Powered by <span className="font-medium text-[var(--text-dim)]">Qwen</span></span></footer>
    </main>
  );
}