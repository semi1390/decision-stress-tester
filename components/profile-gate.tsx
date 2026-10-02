"use client";

import { useEffect, useState } from "react";
import { profileStore, ensureSchema, type Profile } from "@/lib/storage";

export const AVATARS = ["🦉", "🦊", "🐺", "🦅", "🐢", "🐙", "🦁", "💧", "🐬", "🐝"];

/**
 * First-visit local-profile setup (name + avatar). No auth, no backend.
 * Emits the saved profile to the shell. "Skip" still records a minimal profile
 * so the prompt doesn't re-appear.
 */
export default function ProfileGate({ onSaved }: { onSaved: (p: Profile) => void }) {
  const [mounted, setMounted] = useState(false);
  const [needsProfile, setNeedsProfile] = useState(false);
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState(AVATARS[0]);

  useEffect(() => {
    setMounted(true);
    ensureSchema();
    const existing = profileStore.get();
    if (existing) onSaved(existing);
    else setNeedsProfile(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!mounted || !needsProfile) return null;

  function commit(displayName: string) {
    const profile: Profile = { name: displayName.trim() || "Trader", emoji, createdAt: new Date().toISOString() };
    profileStore.set(profile);
    onSaved(profile);
    setNeedsProfile(false);
  }

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/65 p-4 backdrop-blur-sm sm:p-6">
      <div className="menu-in w-full max-w-lg rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 sm:p-7">
        <div className="text-sm text-[var(--text-dim)]">Welcome to Reckon</div>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--text)]">Set up your local profile</h2>
        <p className="mt-2 text-sm leading-relaxed text-[var(--text-dim)]">No account and no password. Your name and avatar stay on this device.</p>

        <label className="mt-6 block text-xs font-medium text-[var(--text-mute)]">Your name</label>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && commit(name)}
          placeholder="Your name"
          className="mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3 text-[15px] text-[var(--text)] outline-none transition-colors focus:border-[var(--border-2)] placeholder:text-[var(--text-mute)]"
        />

        <div className="mt-5 text-xs font-medium text-[var(--text-mute)]">Pick an avatar</div>
        <div className="mt-2.5 flex flex-wrap gap-2.5">
          {AVATARS.map((e) => (
            <button
              key={e}
              onClick={() => setEmoji(e)}
              className={`grid h-11 w-11 place-items-center rounded-xl border text-lg transition ${
                emoji === e ? "border-indigo-400/70 bg-indigo-400/10 ring-2 ring-indigo-400/40" : "border-[var(--border)] bg-[var(--surface-2)] hover:border-[var(--border-2)]"
              }`}
            >
              {e}
            </button>
          ))}
        </div>

        <div className="mt-7 flex items-center justify-end gap-2.5">
          <button onClick={() => commit("Trader")} className="rounded-xl border border-[var(--border-2)] bg-[var(--surface-2)] px-4 py-2.5 text-sm font-medium text-[var(--text-dim)] transition hover:text-[var(--text)]">Skip</button>
          <button onClick={() => commit(name)} className="rounded-xl bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-[var(--accent-text)] transition hover:bg-[var(--accent-hover)]">Save profile</button>
        </div>
      </div>
    </div>
  );
}