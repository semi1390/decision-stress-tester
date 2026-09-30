/**
 * Reckon persistence layer — localStorage only (no backend, no auth).
 *
 * All access goes through here so every read/write is namespaced, typed,
 * try/catch-wrapped, tolerant of empty/corrupt values, and SSR-safe (never
 * touches `window` at import time; only inside functions). Data is
 * device-local and losable by design.
 */

export const SCHEMA_VERSION = 1;

export const KEYS = {
  profile: "reckon:profile",
  theses: "reckon:theses",
  history: "reckon:history",
  portfolio: "reckon:portfolio",
  settings: "reckon:settings",
  schemaVersion: "reckon:schemaVersion",
} as const;

/* ── low-level, guarded ──────────────────────────────────────────── */
function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}
function readRaw(key: string): string | null {
  try {
    return isBrowser() ? window.localStorage.getItem(key) : null;
  } catch {
    return null;
  }
}
function writeRaw(key: string, value: string): boolean {
  try {
    if (!isBrowser()) return false;
    window.localStorage.setItem(key, value);
    return true;
  } catch {
    return false; // quota exceeded / disabled storage
  }
}
function removeRaw(key: string): boolean {
  try {
    if (isBrowser()) window.localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

function getObject<T>(key: string, fallback: T): T {
  const raw = readRaw(key);
  if (raw == null) return fallback;
  try {
    const parsed = JSON.parse(raw);
    return (parsed ?? fallback) as T;
  } catch {
    return fallback; // corrupt value
  }
}
function setObject<T>(key: string, value: T): boolean {
  try {
    return writeRaw(key, JSON.stringify(value));
  } catch {
    return false;
  }
}

/* ── collections (array-of-identifiable) ─────────────────────────── */
interface Identifiable {
  id: string;
  createdAt: string;
}
function listItems<T extends Identifiable>(key: string): T[] {
  const v = getObject<T[]>(key, []);
  return Array.isArray(v) ? v : [];
}
function getItem<T extends Identifiable>(key: string, id: string): T | null {
  return listItems<T>(key).find((x) => x.id === id) ?? null;
}
/** Insert or replace by id (newest first). */
function upsertItem<T extends Identifiable>(key: string, item: T): boolean {
  const arr = listItems<T>(key);
  const i = arr.findIndex((x) => x.id === item.id);
  if (i >= 0) arr[i] = item;
  else arr.unshift(item);
  return setObject(key, arr);
}
function removeItem(key: string, id: string): boolean {
  return setObject(
    key,
    listItems<Identifiable>(key).filter((x) => x.id !== id),
  );
}
function clearCollection(key: string): boolean {
  return setObject(key, []);
}

function makeCollection<T extends Identifiable>(key: string) {
  return {
    list: () => listItems<T>(key),
    get: (id: string) => getItem<T>(key, id),
    upsert: (item: T) => upsertItem<T>(key, item),
    remove: (id: string) => removeItem(key, id),
    clear: () => clearCollection(key),
  };
}

/* ── record shapes (kept minimal now; extended by later features) ── */
export interface Profile {
  name: string;
  emoji?: string;
  createdAt: string;
}
export interface ThesisRecord extends Identifiable {
  ticker?: string;
  title?: string;
  [k: string]: unknown;
}
export interface HistoryEntry extends Identifiable {
  ticker?: string;
  [k: string]: unknown;
}
export interface PortfolioPosition extends Identifiable {
  ticker?: string;
  [k: string]: unknown;
}
export interface Settings {
  [k: string]: unknown;
}

/* ── public stores ───────────────────────────────────────────────── */
export const profileStore = {
  get: (): Profile | null => getObject<Profile | null>(KEYS.profile, null),
  set: (p: Profile): boolean => setObject(KEYS.profile, p),
  clear: (): boolean => removeRaw(KEYS.profile),
};

export const settingsStore = {
  get: (): Settings => getObject<Settings>(KEYS.settings, {}),
  set: (s: Settings): boolean => setObject(KEYS.settings, s),
  clear: (): boolean => removeRaw(KEYS.settings),
};

export const thesesStore = makeCollection<ThesisRecord>(KEYS.theses);
export const historyStore = makeCollection<HistoryEntry>(KEYS.history);
export const portfolioStore = makeCollection<PortfolioPosition>(KEYS.portfolio);

/** Stamp the schema version once storage is used; hook for future migrations. */
export function ensureSchema(): void {
  const current = getObject<number | null>(KEYS.schemaVersion, null);
  if (current !== SCHEMA_VERSION) setObject(KEYS.schemaVersion, SCHEMA_VERSION);
}

/** Wipe all Reckon-owned keys (used by Settings → clear data). */
export function clearAllData(): void {
  Object.values(KEYS).forEach(removeRaw);
}

/** Small helper for creating ids in client code. */
export function newId(prefix = "id"): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}