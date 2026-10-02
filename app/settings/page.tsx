"use client";

import { useEffect, useState } from "react";
import { profileStore, clearAllData, SCHEMA_VERSION, type Profile } from "@/lib/storage";

const EMOJIS = ["🦊", "📈", "🧠", "🎯", "🦉", "⚡", "🐢", "🦈", "🔭", "🧩"];

export default function SettingsPage() {
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState(EMOJIS[0]);
  const [saved, setSaved] = useState(false);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    const p = profileStore.get();
    if (p) {
      setName(p.name);
      if (p.emoji) setEmoji(p.emoji);
    }
  }, []);

  function save() {
    const existing = profileStore.get();
    const profile: Profile = {
      name: name.trim() || "Trader",
      emoji,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
    };
    profileStore.set(profile);
    setSaved(true);
    setTimeout(() => setSaved(false), 1600);
  }

  function wipe() {
    clearAllData();
    setConfirming(false);
    window.location.href = "/";
  }

  return (
    <main className="mx-auto max-w-[720px] px-4 py-8 sm:px-6 md:py-12">
      <h1 className="text-2xl font-semibold tracking-tight text-[var(--text)]">Settings</h1>
      <p className="mt-2 text-sm text-[var(--text-dim)]">Your profile and data live only on this device.</p>

      <section className="mt-8 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <h2 className="text-[15px] font-semibold text-[var(--text)]">Profile</h2>

        <label className="mt-4 block text-xs font-medium text-[var(--text-mute)]">Name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
          className="mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3.5 py-2.5 text-sm text-[var(--text)] outline-none focus:border-[var(--border-2)] placeholder:text-[var(--text-mute)]"
        />

        <div className="mt-4 text-xs font-medium text-[var(--text-mute)]">Avatar</div>
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

        <div className="mt-5 flex items-center gap-3">
          <button onClick={save} className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black transition-transform hover:scale-[1.02] active:scale-95">Save profile</button>
          {saved && <span className="text-xs text-emerald-300">Saved ✓</span>}
        </div>
      </section>

      <section className="mt-4 rounded-2xl border border-red-400/20 bg-red-400/[0.04] p-5">
        <h2 className="text-[15px] font-semibold text-[var(--text)]">Data</h2>
        <p className="mt-2 text-sm text-[var(--text-dim)]">
          Clear your profile, saved theses, portfolio and history from this device. This can&apos;t be undone.
        </p>
        {!confirming ? (
          <button onClick={() => setConfirming(true)} className="mt-4 rounded-xl border border-red-400/40 bg-red-400/[0.08] px-4 py-2 text-sm font-medium text-red-300 transition hover:bg-red-400/[0.14]">
            Clear all data
          </button>
        ) : (
          <div className="mt-4 flex items-center gap-3">
            <button onClick={wipe} className="rounded-xl bg-red-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-600">Yes, delete everything</button>
            <button onClick={() => setConfirming(false)} className="rounded-xl border border-[var(--border-2)] bg-[var(--surface-2)] px-4 py-2 text-sm text-[var(--text-dim)] transition hover:text-[var(--text)]">Cancel</button>
          </div>
        )}
      </section>

      <p className="mono mt-6 text-center text-[11px] text-[var(--text-mute)]">Reckon · local storage · schema v{SCHEMA_VERSION}</p>
    </main>
  );
}