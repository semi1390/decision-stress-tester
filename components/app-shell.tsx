"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import ProfileGate from "./profile-gate";
import { profileStore, settingsStore, clearAllData, type Profile } from "@/lib/storage";

/* ── icons ── */
function I({ d, fill = false }: { d: string; fill?: boolean }) {
  return <svg viewBox="0 0 24 24" className="h-[17px] w-[17px]" fill={fill ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>;
}
const NAV = [
  { href: "/", label: "Home", icon: "M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10" },
  { href: "/discover", label: "Discover", icon: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM21 21l-4-4" },
  { href: "/research", label: "Research", icon: "M4 18l5-6 4 3 6-8M3 21h18" },
  { href: "/theses", label: "My Theses", short: "Theses", icon: "M6 3h9l3 3v15l-6-3-6 3V3zM9 8h6M9 12h6" },
  { href: "/portfolio", label: "Portfolio", icon: "M3 7h18v13H3zM8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" },
  { href: "/history", label: "History", icon: "M12 8v4l3 2M3.05 11a9 9 0 1 1 .5 4M3 4v4h4" },
];

function Brand() {
  return (
    <Link href="/" className="flex shrink-0 items-center gap-2.5">
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--surface-2)] ring-1 ring-inset ring-[var(--border-2)]">
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="url(#rg)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <defs><linearGradient id="rg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#818cf8" /><stop offset="1" stopColor="#4ade80" /></linearGradient></defs>
          <path d="M5 20V9M12 20V4M19 20v-7" />
        </svg>
      </span>
      <span className="text-[15px] font-semibold tracking-tight text-[var(--text)]">Reckon</span>
    </Link>
  );
}

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button onClick={onToggle} className={`relative h-[22px] w-[38px] shrink-0 rounded-full transition-colors ${on ? "bg-emerald-500" : "bg-white/15"}`} aria-pressed={on}>
      <span className={`absolute top-[3px] h-4 w-4 rounded-full bg-white transition-all ${on ? "left-[19px]" : "left-[3px]"}`} />
    </button>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [dark, setDark] = useState(true);
  const [q, setQ] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  useEffect(() => {
    setProfile(profileStore.get());
    const s = settingsStore.get();
    const t = (s as { theme?: string }).theme === "light" ? "light" : "dark";
    setDark(t === "dark");
    document.documentElement.setAttribute("data-theme", t);
  }, [pathname]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement;
      const typing = el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA");
      if (e.key === "/" && !typing) { e.preventDefault(); searchRef.current?.focus(); }
      if (e.key === "Escape") { setMenuOpen(false); setHelpOpen(false); }
    };
    const onClick = (e: MouseEvent) => { if (menuOpen && menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false); };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onClick);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("mousedown", onClick); };
  }, [menuOpen]);

  function toggleTheme() {
    const next = dark ? "light" : "dark";
    setDark(!dark);
    document.documentElement.setAttribute("data-theme", next);
    settingsStore.set({ ...settingsStore.get(), theme: next });
  }
  function runSearch() {
    const t = q.trim().toUpperCase();
    if (t) router.push(`/research?symbol=${encodeURIComponent(t)}`);
    setQ("");
  }
  function clearData() {
    if (typeof window !== "undefined" && window.confirm("Clear all Reckon data on this device? This can't be undone.")) {
      clearAllData();
      window.location.href = "/";
    }
  }

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--bg)]/85 backdrop-blur-md">
        <div className="mx-auto max-w-[1240px] px-4 md:px-6">
          {/* row 1: brand · search · actions */}
          <div className="flex h-16 items-center gap-4">
            <Brand />
            <div className="relative hidden max-w-[340px] flex-1 items-center md:flex">
              <svg viewBox="0 0 24 24" className="pointer-events-none absolute left-3 h-4 w-4 text-[var(--text-mute)]" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4-4" strokeLinecap="round" /></svg>
              <input ref={searchRef} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && runSearch()} placeholder="Search a ticker" className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] py-2 pl-9 pr-9 text-sm text-[var(--text)] outline-none transition-colors focus:border-[var(--border-2)] placeholder:text-[var(--text-mute)]" />
              <kbd className="mono pointer-events-none absolute right-2.5 rounded border border-[var(--border-2)] bg-[var(--surface-2)] px-1.5 py-0.5 text-[10px] text-[var(--text-mute)]">/</kbd>
            </div>

            <div className="ml-auto flex items-center gap-2.5">
              <Link href="/discover" aria-label="Search" className="grid h-9 w-9 place-items-center rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text-mute)] transition hover:text-[var(--text)] md:hidden"><svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4-4" strokeLinecap="round" /></svg></Link>
              <span className="hidden items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs text-[var(--text-dim)] md:inline-flex">
                <span className="h-1.5 w-1.5 rounded-full bg-indigo-400" />Powered by <span className="font-semibold text-[var(--text)]">Qwen</span>
              </span>
              <Link href="/research" className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--accent)] px-3.5 py-2 text-sm font-semibold text-[var(--accent-text)] transition hover:bg-[var(--accent-hover)]">
                <span className="text-base leading-none">+</span><span className="hidden sm:inline">New research</span>
              </Link>

              <div className="relative" ref={menuRef}>
                <button onClick={() => setMenuOpen((o) => !o)} aria-label="Profile menu" className="grid h-9 w-9 place-items-center rounded-full border border-[var(--border-2)] bg-[var(--surface-2)] text-base transition hover:border-white/25">
                  {menuOpen ? <svg viewBox="0 0 24 24" className="h-4 w-4 text-[var(--text-dim)]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg> : (profile?.emoji ?? "🙂")}
                </button>

                {menuOpen && (
                  <div className="menu-in absolute right-0 top-[calc(100%+8px)] w-64 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-1.5 shadow-2xl shadow-black/40">
                    <Link href="/settings" onClick={() => setMenuOpen(false)} className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 transition hover:bg-[var(--surface-2)]">
                      <span className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--surface-2)] text-base">{profile?.emoji ?? "🙂"}</span>
                      <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-[var(--text)]">{profile?.name ?? "Guest"}</span></span>
                      <svg viewBox="0 0 24 24" className="h-4 w-4 text-[var(--text-mute)]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></svg>
                    </Link>
                    <div className="flex items-center gap-2.5 px-2.5 py-1.5 text-xs text-[var(--text-mute)]"><I d="M6 10V7a6 6 0 1 1 12 0v3M5 10h14v10H5z" />Profile stored on this device</div>
                    <div className="my-1 h-px bg-[var(--border)]" />
                    <Link href="/settings" onClick={() => setMenuOpen(false)} className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm text-[var(--text-dim)] transition hover:bg-[var(--surface-2)] hover:text-[var(--text)]"><I d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 13a1.6 1.6 0 0 0 .3 1.8M4.6 13a1.6 1.6 0 0 1 0-2M12 4.5V2M12 22v-2.5" />Settings</Link>
                    <div className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm text-[var(--text-dim)]"><I d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /><span className="flex-1">Dark theme</span><Toggle on={dark} onToggle={toggleTheme} /></div>
                    <button onClick={() => { setHelpOpen(true); setMenuOpen(false); }} className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm text-[var(--text-dim)] transition hover:bg-[var(--surface-2)] hover:text-[var(--text)]"><I d="M12 17h.01M9.1 9a3 3 0 1 1 4.2 2.7c-.8.4-1.3 1-1.3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z" />Help &amp; disclaimer</button>
                    <div className="my-1 h-px bg-[var(--border)]" />
                    <button onClick={clearData} className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm text-red-400 transition hover:bg-red-500/10"><I d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" />Clear local data</button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* row 2: nav · status chip */}
          <div className="hidden h-11 items-center gap-1 overflow-x-auto md:flex">
            {NAV.map((it) => {
              const active = isActive(it.href);
              return (
                <Link key={it.href} href={it.href} className={`flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm transition ${active ? "font-semibold text-[var(--text)]" : "text-[var(--text-dim)] hover:text-[var(--text)]"}`}>
                  <span className={active ? "text-[var(--text)]" : "text-[var(--text-mute)]"}><I d={it.icon} /></span>{it.label}
                </Link>
              );
            })}
            <div className="mx-2 hidden h-4 w-px bg-[var(--border)] sm:block" />
            <span className="ml-auto hidden shrink-0 items-center gap-1.5 text-xs text-[var(--text-mute)] sm:inline-flex sm:ml-0"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />US stocks · EOD closes</span>
          </div>
        </div>
      </header>

      <div className="pb-[72px] md:pb-0">{children}</div>

      {/* mobile bottom tab bar */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-[var(--border)] bg-[var(--bg)]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden">
        {NAV.map((it) => {
          const active = isActive(it.href);
          return (
            <Link key={it.href} href={it.href} className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition ${active ? "text-[var(--text)]" : "text-[var(--text-mute)]"}`}>
              <span className={active ? "text-indigo-300" : ""}><I d={it.icon} /></span>
              {(it as { short?: string }).short ?? it.label}
            </Link>
          );
        })}
      </nav>

      <ProfileGate onSaved={setProfile} />

      {helpOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-6 backdrop-blur-sm" onClick={() => setHelpOpen(false)}>
          <div className="menu-in w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold tracking-tight text-[var(--text)]">Help &amp; disclaimer</h2>
            <p className="mt-3 text-sm leading-relaxed text-[var(--text-dim)]">Reckon is a research tool for US stocks. Describe a trade idea; it reads the filings, checks how similar setups moved historically, and argues the other side. The AI recommends — you make the final call.</p>
            <ul className="mt-3 space-y-1.5 text-[13px] text-[var(--text-dim)]">
              <li>· Prices are end-of-day closes, not real-time.</li>
              <li>· Analyst consensus is often unavailable, so beat/miss can't always be shown.</li>
              <li>· Execution is simulated/paper — Reckon never places real orders.</li>
              <li>· Your data lives only on this device.</li>
            </ul>
            <p className="mt-4 text-xs leading-relaxed text-[var(--text-mute)]">Reckon is for research and education. It isn&apos;t financial advice, and how past setups moved doesn&apos;t guarantee how this one will.</p>
            <button onClick={() => setHelpOpen(false)} className="mt-5 w-full rounded-xl bg-[var(--accent)] py-2.5 text-sm font-semibold text-[var(--accent-text)] transition hover:bg-[var(--accent-hover)]">Got it</button>
          </div>
        </div>
      )}
    </>
  );
}