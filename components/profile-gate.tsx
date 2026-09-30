"use client";

import { useEffect, useState } from "react";
import { profileStore, ensureSchema, type Profile } from "@/lib/storage";

const EMOJIS = ["🦊", "📈", "🧠", "🎯", "🦉", "⚡", "🐢", "🦈", "🔭", "🧩"];

/**
 * Shows a lightweight first-visit prompt (name + emoji) when no profile exists.
 * Purely local — no auth, no backend. Emits the saved profile to the parent.
 */
export default function ProfileGate({ onSaved }: { onSaved: (p: Profile) => void }) {
  const [mounted, setMounted] = useState(false);
  const [needsProfile, setNeedsProfile] = useState(false);
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState(EMOJIS[0]);

  useEffect(() => {
    setMounted(true);
    ensureSchema();
    const existing = profileStore.get();
    if (existing) onSaved(existing);
    else setNeedsProfile(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!mounted || !needsProfile) return null;

  function save() {
    const clean = name.trim() || "Trader";
    const profile: Profile = { name: clean, emoji, createdAt: new Date().toISOString() };
    profileStore.set(profile);
    onSaved(profile);
    setNeedsProfile(false);
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-6 backdrop-blur-sm">
      <div className="animate-in w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
        <h2 className="text-lg font-semibold tracking-tight text-[var(--text)]">Welcome to Reckon</h2>
        <p className="mt-1.5 text-sm text-[var(--text-dim)]">
          A quick hello so we can personalize things. This stays on your device — no account needed.
        </p>

        <label className="mt-5 block text-xs font-medium text-[var(--text-mute)]">What should we call you?</label>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && save()}
          placeholder="Your name"
          className="mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3.5 py-2.5 text-sm text-[var(--text)] outline-none focus:border-[var(--border-2)] placeholder:text-[var(--text-mute)]"
        />

        <div className="mt-4 text-xs font-medium text-[var(--text-mute)]">Pick an avatar</div>
        <div className="mt-2 flex flex-wrap gap-2">
          {EMOJIS.map((e) => (
            <button
              key={e}
              onClick={() => setEmoji(e)}
              className={`grid h-9 w-9 place-items-center rounded-lg border text-lg transition ${
                emoji === e ? "border-indigo-400/60 bg-indigo-400/10" : "border-[var(--border)] bg-[var(--surface-2)] hover:border-[var(--border-2)]"
              }`}
            >
              {e}
            </button>
          ))}
        </div>

        <button
          onClick={save}
          className="mt-6 w-full rounded-xl bg-white py-2.5 text-sm font-semibold text-black transition-transform hover:scale-[1.01] active:scale-95"
        >
          Enter Reckon
        </button>
      </div>
    </div>
  );
}