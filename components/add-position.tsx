"use client";

import { useEffect, useState } from "react";
import { portfolioStore, newId } from "@/lib/storage";
import type { Position } from "@/components/analysis-ui";

export default function AddPosition({
  open, onClose, onAdded, prefill,
}: {
  open: boolean;
  onClose: () => void;
  onAdded: () => void;
  prefill?: { ticker?: string; side?: "long" | "short"; linkedThesisId?: string };
}) {
  const [ticker, setTicker] = useState(prefill?.ticker ?? "");
  const [side, setSide] = useState<"long" | "short">(prefill?.side ?? "long");
  const [size, setSize] = useState("");
  const [entry, setEntry] = useState("");
  const [current, setCurrent] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // Prefetch the current price for the "Use current" affordance + entry default.
  useEffect(() => {
    if (!open) return;
    const sym = (ticker || prefill?.ticker || "").trim().toUpperCase();
    setCurrent(null);
    if (!sym) return;
    let cancelled = false;
    fetch(`/api/pulse?symbol=${encodeURIComponent(sym)}`).then((r) => r.json()).then((j) => {
      if (cancelled || j?.price == null) return;
      const px = Number(j.price);
      setCurrent(px);
      setEntry((e) => e || String(px.toFixed(2)));
    }).catch(() => {});
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  function add() {
    const sym = ticker.trim().toUpperCase();
    const sz = Number(size), px = Number(entry);
    if (!sym) return setErr("Enter a ticker.");
    if (!(sz > 0)) return setErr("Enter a size greater than 0.");
    if (!(px > 0)) return setErr("Enter an entry price greater than 0.");
    const pos: Position = { id: newId("pos"), createdAt: new Date().toISOString(), ticker: sym, side, size: sz, entryPrice: px, openedAt: new Date().toISOString(), linkedThesisId: prefill?.linkedThesisId };
    portfolioStore.upsert(pos);
    onAdded();
    onClose();
  }

  const inputCls = "mono mt-1.5 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3.5 py-2.5 text-sm text-[var(--text)] outline-none transition-colors focus:border-[var(--border-2)]";

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/60 p-6 backdrop-blur-sm" onClick={onClose}>
      <div className="menu-in w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-[var(--text)]">Add position</h2>
            <p className="mt-1 text-sm text-[var(--text-dim)]">A paper position, tracked on this device.</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="grid h-8 w-8 place-items-center rounded-lg text-[var(--text-mute)] transition hover:bg-[var(--surface-2)] hover:text-[var(--text)]"><svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg></button>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-[var(--text-mute)]">Ticker</label>
            <input value={ticker} onChange={(e) => setTicker(e.target.value)} placeholder="NVDA" disabled={!!prefill?.ticker} className={`${inputCls} uppercase disabled:opacity-60`} />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--text-mute)]">Side</label>
            <div className="mt-1.5 grid grid-cols-2 gap-2">
              {(["long", "short"] as const).map((s) => (
                <button key={s} onClick={() => setSide(s)} className={`rounded-xl border py-2.5 text-sm font-medium capitalize transition ${side === s ? (s === "long" ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-300" : "border-red-400/40 bg-red-400/10 text-red-300") : "border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-dim)] hover:text-[var(--text)]"}`}>{s}</button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-[var(--text-mute)]">Size (shares)</label>
            <input value={size} onChange={(e) => setSize(e.target.value)} inputMode="decimal" placeholder="100" className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--text-mute)]">Entry price</label>
            <input value={entry} onChange={(e) => setEntry(e.target.value)} inputMode="decimal" placeholder="0.00" className={inputCls} />
          </div>
        </div>

        <div className="mt-2 flex justify-end">
          <button onClick={() => current != null && setEntry(String(current.toFixed(2)))} disabled={current == null} className="rounded-lg border border-[var(--border-2)] bg-[var(--surface-2)] px-2.5 py-1 text-xs text-[var(--text-dim)] transition hover:text-[var(--text)] disabled:opacity-40">Use current{current != null ? ` $${current.toFixed(2)}` : ""}</button>
        </div>

        {err && <p className="mt-3 text-xs text-red-300">{err}</p>}

        <div className="mt-6 flex items-center justify-end gap-2.5">
          <button onClick={onClose} className="rounded-xl border border-[var(--border-2)] bg-[var(--surface-2)] px-4 py-2.5 text-sm font-medium text-[var(--text-dim)] transition hover:text-[var(--text)]">Cancel</button>
          <button onClick={add} className="rounded-xl bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-[var(--accent-text)] transition hover:bg-[var(--accent-hover)]">Add position</button>
        </div>
      </div>
    </div>
  );
}