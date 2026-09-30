"use client";

import { useId } from "react";

/** Lightweight price line + area over a series of closes. No chart lib. */
export default function PriceChart({
  closes,
  height = 180,
  showBaseline = true,
}: {
  closes: number[];
  height?: number;
  showBaseline?: boolean;
}) {
  const gid = useId().replace(/:/g, "");
  const clean = (closes ?? []).filter((v) => Number.isFinite(v));
  if (clean.length < 2) {
    return <div className="grid h-[--h] place-items-center text-xs text-[var(--text-mute)]" style={{ ["--h" as string]: `${height}px` }}>No price history</div>;
  }

  const W = 800;
  const H = height;
  const pad = 6;
  const min = Math.min(...clean);
  const max = Math.max(...clean);
  const span = max - min || 1;
  const x = (i: number) => (i / (clean.length - 1)) * (W - 2 * pad) + pad;
  const y = (v: number) => H - pad - ((v - min) / span) * (H - 2 * pad);

  const line = clean.map((v, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
  const base = H - pad;
  const area = `${line} L ${x(clean.length - 1).toFixed(1)} ${base} L ${x(0).toFixed(1)} ${base} Z`;

  const up = clean[clean.length - 1] >= clean[0];
  const color = up ? "var(--up)" : "var(--down)";

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full" style={{ height }} role="img" aria-label="price history">
      <defs>
        <linearGradient id={`pc-${gid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.2" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {showBaseline && <line x1={pad} y1={base} x2={W - pad} y2={base} stroke="rgba(255,255,255,0.06)" strokeWidth="1" vectorEffect="non-scaling-stroke" />}
      <path d={area} fill={`url(#pc-${gid})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}