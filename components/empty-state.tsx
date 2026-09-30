import Link from "next/link";

export default function EmptyState({
  icon,
  title,
  body,
  ctaHref,
  ctaLabel,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  ctaHref?: string;
  ctaLabel?: string;
}) {
  return (
    <div className="animate-in mt-8 grid place-items-center rounded-2xl border border-dashed border-[var(--border-2)] bg-[var(--surface)]/40 px-6 py-16 text-center">
      <span className="grid h-12 w-12 place-items-center rounded-xl bg-[var(--surface-2)] text-[var(--text-mute)]">{icon}</span>
      <h2 className="mt-4 text-base font-semibold text-[var(--text)]">{title}</h2>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-[var(--text-dim)]">{body}</p>
      {ctaHref && ctaLabel && (
        <Link href={ctaHref} className="mt-5 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black transition-transform hover:scale-[1.02] active:scale-95">
          {ctaLabel}
        </Link>
      )}
    </div>
  );
}