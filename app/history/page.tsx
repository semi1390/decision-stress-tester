"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { thesesStore } from "@/lib/storage";
import { dir, type SavedThesis } from "@/components/analysis-ui";
import EmptyState from "@/components/empty-state";

const dayUpper = (iso: string) => { try { return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" }).toUpperCase(); } catch { return iso; } };
const time24 = (iso: string) => { try { return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false }); } catch { return ""; } };
const OPT_COLOR: Record<string, string> = { Trade: "text-emerald-300", Watch: "text-amber-300", Pass: "text-red-300" };
const OPT_DOT: Record<string, string> = { Trade: "bg-emerald-400", Watch: "bg-amber-400", Pass: "bg-red-400" };
const DOT_HEX: Record<string, string> = { Trade: "#4ade80", Watch: "#fbbf24", Pass: "#f87171" };

export default function HistoryPage() {
  const [items, setItems] = useState<SavedThesis[] | null>(null);
  useEffect(() => { setItems(thesesStore.list() as unknown as SavedThesis[]); }, []);

  return (
    <main className="mx-auto max-w-[900px] px-6 py-8">
      <h1 className="text-2xl font-semibold tracking-tight text-[var(--text)]">History</h1>
      <p className="mt-2 text-sm text-[var(--text-dim)]">Every decision you committed, newest first. Stored on this device.</p>

      {items === null ? null : items.length === 0 ? (
        <EmptyState icon={<svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 8v4l3 2M3.05 11a9 9 0 1 1 .5 4M3 4v4h4" /></svg>} title="Nothing to look back on yet" body="Every decision you commit shows up here, newest first." ctaHref="/research" ctaLabel="Start research" />
      ) : (
        <div className="relative mt-8">
          <div className="absolute bottom-2 left-[92px] top-2 w-px bg-[var(--border)]" aria-hidden />
          <div className="space-y-3">
            {items.map((t) => {
              const d = dir[t.direction];
              return (
                <div key={t.id} className="relative flex items-start gap-6">
                  <div className="w-[76px] shrink-0 pt-3.5 text-right"><div className="mono text-xs text-[var(--text-dim)]">{dayUpper(t.createdAt)}</div><div className="mono text-[11px] text-[var(--text-mute)]">{time24(t.createdAt)}</div></div>
                  <span className="absolute left-[88px] top-[18px] h-2.5 w-2.5 rounded-full ring-4 ring-[var(--bg)]" style={{ background: DOT_HEX[t.decision] ?? "#9ba1a9" }} aria-hidden />
                  <Link href={`/theses/${t.id}`} className="group min-w-0 flex-1 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 transition hover:border-[var(--border-2)]">
                    <div className="flex items-center gap-2.5">
                      <span className="mono text-sm font-semibold text-[var(--text)]">{t.ticker}</span>
                      <span className={`mono rounded px-1 py-0.5 text-[10px] font-medium ${d.cls}`}>{d.label}</span>
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ${OPT_COLOR[t.decision]}`}><span className={`h-1.5 w-1.5 rounded-full ${OPT_DOT[t.decision]}`} />{t.decision}</span>
                      <span className="min-w-0 flex-1 truncate text-sm text-[var(--text-dim)] group-hover:text-[var(--text)]">{t.thesis}</span>
                      <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-[var(--text-mute)] transition group-hover:text-[var(--text)]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>
                    </div>
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <footer className="mt-10 flex flex-col items-start justify-between gap-3 border-t border-[var(--border)] pt-6 text-xs text-[var(--text-mute)] sm:flex-row"><p className="max-w-2xl leading-relaxed">Reckon is for research and education. It isn&apos;t financial advice, and how past setups moved doesn&apos;t guarantee how this one will.</p><span className="shrink-0">Powered by <span className="font-medium text-[var(--text-dim)]">Qwen</span></span></footer>
    </main>
  );
}