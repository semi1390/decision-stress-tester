"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { thesesStore } from "@/lib/storage";
import { AIAnalysis, dir, type SavedThesis } from "@/components/analysis-ui";
import AddPosition from "@/components/add-position";

const dateTime = (iso: string) => { try { return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" }); } catch { return iso; } };
const dayOnly = (iso: string) => { try { return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" }); } catch { return iso; } };
const OPT_COLOR: Record<string, string> = { Trade: "text-emerald-300", Watch: "text-amber-300", Pass: "text-red-300" };
const OPT_DOT: Record<string, string> = { Trade: "bg-emerald-400", Watch: "bg-amber-400", Pass: "bg-red-400" };

export default function ThesisDetail() {
  const params = useParams();
  const router = useRouter();
  const id = String(params?.id ?? "");
  const [t, setT] = useState<SavedThesis | null | undefined>(undefined);
  const [adding, setAdding] = useState(false);

  useEffect(() => { setT((thesesStore.get(id) as unknown as SavedThesis) ?? null); }, [id]);

  if (t === undefined) return <main className="px-6 py-10 text-sm text-[var(--text-mute)]">Loading…</main>;
  if (t === null) return (
    <main className="mx-auto max-w-[760px] px-6 py-16 text-center"><h1 className="text-xl font-semibold text-[var(--text)]">Thesis not found</h1><p className="mt-2 text-sm text-[var(--text-dim)]">It may have been deleted from this device.</p><Link href="/theses" className="mt-5 inline-block rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--accent-text)]">Back to My Theses</Link></main>
  );

  const d = dir[t.direction];
  function del() { thesesStore.remove(id); router.push("/theses"); }

  return (
    <main className="mx-auto max-w-[1180px] px-6 pb-16 pt-8">
      <div className="flex items-center justify-between gap-3">
        <Link href="/theses" className="inline-flex items-center gap-1.5 text-sm text-[var(--text-dim)] transition hover:text-[var(--text)]"><span aria-hidden>‹</span> My theses</Link>
        <div className="flex items-center gap-2">
          <button onClick={del} aria-label="Delete" className="grid h-9 w-9 place-items-center rounded-lg border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-mute)] transition hover:border-red-400/40 hover:text-red-300"><svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" /></svg></button>
          <button onClick={() => setAdding(true)} className="rounded-lg border border-[var(--border-2)] bg-[var(--surface-2)] px-3.5 py-1.5 text-sm text-[var(--text-dim)] transition hover:text-[var(--text)]">+ Add to portfolio</button>
          {t.decision === "Trade" && <Link href={`/execute/${t.id}`} className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent)] px-3.5 py-1.5 text-sm font-semibold text-[var(--accent-text)] transition hover:bg-[var(--accent-hover)]">Execute trade <span aria-hidden>→</span></Link>}
        </div>
      </div>

      {/* banner */}
      <div className="animate-in mt-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
          <div className="flex items-center gap-3.5"><span className="mono grid h-11 w-11 place-items-center rounded-xl bg-[var(--surface-2)] text-sm font-medium text-[var(--text-dim)]">{t.ticker.slice(0, 2)}</span><div><div className="flex items-center gap-2"><span className="text-lg font-semibold tracking-tight">{t.ticker}</span><span className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium ring-1 ring-inset ${d.cls}`}><span aria-hidden>{d.arrow}</span>{d.label}</span></div><div className="text-xs text-[var(--text-dim)]">{t.companyName ?? t.ticker} · saved {dateTime(t.createdAt)}</div></div></div>
          <div className="ml-auto flex items-center gap-8">
            <div><div className="text-[11px] uppercase tracking-wide text-[var(--text-mute)]">Your decision</div><div className={`mt-1 inline-flex items-center gap-1.5 text-sm font-semibold ${OPT_COLOR[t.decision]}`}><span className={`h-1.5 w-1.5 rounded-full ${OPT_DOT[t.decision]}`} />{t.decision}</div></div>
            {t.aiDecision && <div><div className="text-[11px] uppercase tracking-wide text-[var(--text-mute)]">AI suggested</div><div className={`mt-1 inline-flex items-center gap-1.5 text-sm font-semibold ${OPT_COLOR[t.aiDecision]}`}><span className={`h-1.5 w-1.5 rounded-full ${OPT_DOT[t.aiDecision]}`} />{t.aiDecision}</div></div>}
          </div>
        </div>
      </div>

      {/* snapshot note */}
      <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-2)]/40 px-4 py-2.5 text-xs text-[var(--text-mute)]">
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 8v4l3 2M3 12a9 9 0 1 0 18 0 9 9 0 0 0-18 0z" /></svg>
        <span>Snapshot from when you committed on {dayOnly(t.createdAt)}. Prices and filings below may have changed since.</span>
        <span className="ml-auto flex items-center gap-1"><svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M6 10V7a6 6 0 1 1 12 0v3M5 10h14v10H5z" /></svg>Stored on this device</span>
      </div>

      <AIAnalysis r={t} headerRight={<span className="text-xs text-[var(--text-mute)]">as saved</span>} />

      {t.news?.items?.length ? (
        <div className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <div className="flex items-center justify-between gap-3"><h2 className="text-[15px] font-semibold text-[var(--text)]">Filings at save time</h2><span className="text-xs text-[var(--text-mute)]">SEC EDGAR · as of {dayOnly(t.createdAt)}</span></div>
          <ul className="mt-2 divide-y divide-[var(--border)]">{t.news.items.map((n, i) => (
            <li key={i}><a href={n.url} target="_blank" rel="noreferrer" className="group flex items-center gap-3 py-2.5"><span className="mono w-[92px] shrink-0 text-xs text-[var(--text-mute)]">{n.publishedAt ?? "—"}</span><span className="mono shrink-0 rounded border border-[var(--border)] bg-[var(--surface-2)] px-1 py-0.5 text-[10px] text-[var(--text-dim)]">{n.formType ?? "SEC"}</span><span className="min-w-0 flex-1"><span className="block truncate text-[13px] text-[var(--text)]">{n.title}</span>{n.summary && <span className="block truncate text-[11px] text-[var(--text-dim)]">{n.summary}</span>}</span><svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0 text-[var(--text-mute)] transition group-hover:text-[var(--text)]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M7 17L17 7M9 7h8v8" /></svg></a></li>
          ))}</ul>
        </div>
      ) : null}

      <AddPosition open={adding} onClose={() => setAdding(false)} onAdded={() => router.push("/portfolio")} prefill={{ ticker: t.ticker, side: t.direction === "short" ? "short" : "long", linkedThesisId: t.id }} />

      <footer className="mt-10 flex flex-col items-start justify-between gap-3 border-t border-[var(--border)] pt-6 text-xs text-[var(--text-mute)] sm:flex-row"><p className="max-w-2xl leading-relaxed">Reckon is for research and education. It isn&apos;t financial advice, and how past setups moved doesn&apos;t guarantee how this one will.</p><span className="shrink-0">Powered by <span className="font-medium text-[var(--text-dim)]">Qwen</span></span></footer>
    </main>
  );
}