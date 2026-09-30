import type {
  StockDataProvider,
  Quote,
  Earnings,
  EarningsReport,
  Estimates,
  News,
  NewsItem,
  Klines,
  Kline,
  ProviderName,
} from "./types";

/**
 * FallbackProvider — keyless public data sources, so the tool keeps working
 * even if Bitget is unreachable:
 *
 *   • Prices      → stockanalysis.com chart API (close-only), then Stooq
 *                   (true OHLCV) as a secondary. Each source is strictly
 *                   validated; a challenge / HTML / malformed body is rejected
 *                   and the next source is tried. If all fail → loud error.
 *   • SEC EDGAR   → earnings EPS history (XBRL) + recent 8-K/6-K filings (news).
 *                   Keyless, but asks for a descriptive User-Agent (SEC_USER_AGENT).
 *   • Estimates   → forward analyst estimates have no reliable keyless source.
 *                   Bitget is primary here; the fallback reports this honestly.
 *
 * Contract: every method returns valid data or THROWS. It never returns
 * NaN / null-close / empty-bar garbage.
 */

const SEC_UA =
  process.env.SEC_USER_AGENT ?? "Decision Stress-Tester (contact@example.com)";
const BROWSER_UA = "Mozilla/5.0 (compatible; DecisionStressTester/0.1)";

async function fetchJson<T = any>(url: string, headers: Record<string, string> = {}): Promise<T> {
  const res = await fetch(url, { headers, cache: "no-store" });
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return (await res.json()) as T;
}

// ── Price source #1: stockanalysis.com chart API (keyless, close-only) ───────
// Response shape (observed): { status, data: [[unixMs, price], ...] }.
// This is an internal endpoint with no stability guarantee — hence the strict
// validation and the Stooq secondary below.

/** Pure parser: JSON body text -> Kline[]. Throws on any malformed shape. */
export function parseStockAnalysisHistory(body: string): Kline[] {
  const trimmed = body.trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) {
    throw new Error("stockanalysis returned non-JSON (blocked / challenge page?)");
  }
  let json: any;
  try {
    json = JSON.parse(trimmed);
  } catch {
    throw new Error("stockanalysis returned unparseable JSON");
  }
  const data = json?.data ?? json;
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error("stockanalysis returned no data array");
  }
  const bars: Kline[] = [];
  for (const row of data) {
    if (!Array.isArray(row) || row.length < 2) continue;
    const ts = Number(row[0]);
    const close = Number(row[1]);
    // Prices and timestamps are always positive; this also rejects null→0.
    if (!Number.isFinite(ts) || !Number.isFinite(close) || ts <= 0 || close <= 0) continue;
    const date = new Date(ts).toISOString().slice(0, 10);
    // Close-only source: open/high/low mirror close; volume unknown (0).
    bars.push({ date, open: close, high: close, low: close, close, volume: 0 });
  }
  if (bars.length === 0) throw new Error("stockanalysis: no finite [ts, price] pairs");
  return bars;
}

async function fetchStockAnalysisHistory(symbol: string): Promise<Kline[]> {
  const sym = symbol.toUpperCase();
  const url = `https://stockanalysis.com/api/symbol/s/${sym}/history?type=chart&range=5Y`;
  const res = await fetch(url, {
    cache: "no-store",
    headers: {
      "User-Agent": BROWSER_UA,
      Accept: "application/json",
      Referer: `https://stockanalysis.com/stocks/${symbol.toLowerCase()}/`,
    },
  });
  if (!res.ok) throw new Error(`stockanalysis -> HTTP ${res.status}`);
  return parseStockAnalysisHistory(await res.text());
}

// ── Price source #2: Stooq (keyless, true EOD OHLCV) ─────────────────────────

/** Pure parser: CSV text -> Kline[]. Throws on anti-bot / non-CSV bodies. */
export function parseStooqCsv(csv: string): Kline[] {
  const text = csv.trim();
  const firstLine = (text.split("\n")[0] ?? "").trim().toLowerCase();
  // Real Stooq CSV starts with this exact header. Anything else (HTML, a JS
  // anti-bot challenge, an error page) is rejected here instead of being
  // silently coerced into NaN bars.
  if (!firstLine.startsWith("date,open,high,low,close")) {
    throw new Error("stooq returned non-CSV (anti-bot challenge or error page)");
  }
  const lines = text.split("\n");
  const bars: Kline[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",");
    if (cols.length < 6) continue;
    const [date, open, high, low, close, volume] = cols;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    const o = +open, h = +high, l = +low, c = +close, v = +volume;
    // Prices are always positive; rejects blanks/"N/D"→NaN and null→0.
    if (![o, h, l, c].every((n) => Number.isFinite(n) && n > 0)) continue;
    bars.push({ date, open: o, high: h, low: l, close: c, volume: Number.isFinite(v) ? v : 0 });
  }
  if (bars.length === 0) throw new Error("stooq: no valid data rows after parse");
  return bars;
}

async function fetchStooqHistory(symbol: string): Promise<Kline[]> {
  const res = await fetch(`https://stooq.com/q/d/l/?s=${symbol.toLowerCase()}.us&i=d`, {
    cache: "no-store",
    headers: { "User-Agent": BROWSER_UA },
  });
  if (!res.ok) throw new Error(`stooq -> HTTP ${res.status}`);
  return parseStooqCsv(await res.text());
}

/** A bar set is only valid if it's non-empty with all-finite closes. */
function assertBars(bars: Kline[]): void {
  if (!bars.length) throw new Error("empty bar set");
  if (!bars.every((b) => Number.isFinite(b.close))) throw new Error("non-finite close in bars");
}

// ── SEC EDGAR (keyless; requires descriptive UA) ────────────────────────────

interface TickerInfo {
  cik: string;
  name: string;
}
let tickerMap: Map<string, TickerInfo> | null = null;

async function loadTickerMap(): Promise<Map<string, TickerInfo>> {
  if (!tickerMap) {
    const data = await fetchJson<Record<string, { cik_str: number; ticker: string; title: string }>>(
      "https://www.sec.gov/files/company_tickers.json",
      { "User-Agent": SEC_UA },
    );
    const m = new Map<string, TickerInfo>();
    for (const key of Object.keys(data)) {
      const row = data[key];
      m.set(row.ticker.toUpperCase(), {
        cik: String(row.cik_str).padStart(10, "0"),
        name: row.title,
      });
    }
    tickerMap = m;
  }
  return tickerMap;
}

async function resolveCik(symbol: string): Promise<string | null> {
  return (await loadTickerMap()).get(symbol.toUpperCase())?.cik ?? null;
}

/** Resolve a ticker to its CIK + company name, or null if it doesn't exist. */
export async function lookupTicker(symbol: string): Promise<{ cik: string; name: string } | null> {
  return (await loadTickerMap()).get(symbol.toUpperCase()) ?? null;
}

function editDistance(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
  return dp[m][n];
}

/** Suggest the closest real ticker to a mistyped one ("did you mean"). */
export async function suggestTicker(symbol: string): Promise<{ symbol: string; name: string } | null> {
  const q = symbol.toUpperCase();
  const map = await loadTickerMap();
  let best: { symbol: string; name: string } | null = null;
  let bestScore = Infinity;
  for (const [tk, info] of map) {
    if (Math.abs(tk.length - q.length) > 2) continue;
    let score = editDistance(q, tk);
    if (tk[0] === q[0]) score -= 0.5;
    if (tk.startsWith(q.slice(0, 2))) score -= 0.5;
    if (score < bestScore) {
      bestScore = score;
      best = { symbol: tk, name: info.name };
    }
  }
  return bestScore <= 1.5 ? best : null;
}

/** A single XBRL EPS fact (from SEC companyconcept units). */
export interface EpsUnit {
  form?: string;
  filed?: string; // YYYY-MM-DD, the SEC filing date
  start?: string; // period start (duration facts)
  end?: string; // fiscal period end
  fy?: number;
  fp?: string; // Q1 / Q2 / Q3 / FY
  val?: number;
}

function durationDays(u: EpsUnit): number {
  if (!u.start || !u.end) return Number.MAX_SAFE_INTEGER;
  const ms = Date.parse(u.end) - Date.parse(u.start);
  return Number.isFinite(ms) ? ms / 86_400_000 : Number.MAX_SAFE_INTEGER;
}

/**
 * Collapse raw XBRL EPS units into unique earnings EVENTS.
 *
 * SEC returns many units per filing (the quarter's EPS, the year-to-date EPS,
 * and prior-period comparatives), all sharing a filing date — and the same
 * fiscal period reappears in later filings as a comparative. Naively slicing
 * units therefore collapses to far fewer unique dates than it looks.
 *
 * This selects one event per fiscal-period end, dated by the ORIGINAL report
 * (the earliest `filed` for that end, not a later comparative), and takes the
 * representative EPS as the shortest-duration fact at that original filing (the
 * quarter, not the YTD figure). Returns newest-first, capped at `maxEvents`.
 * It never fabricates events — it only dedupes real filings.
 */
export function selectEarningsEvents(
  symbol: string,
  units: EpsUnit[],
  maxEvents = 20,
): EarningsReport[] {
  const byEnd = new Map<string, EpsUnit[]>();
  for (const u of units) {
    if ((u.form !== "10-Q" && u.form !== "10-K") || !u.filed || !u.end) continue;
    const arr = byEnd.get(u.end);
    if (arr) arr.push(u);
    else byEnd.set(u.end, [u]);
  }

  const events = Array.from(byEnd.entries()).map(([end, group]) => {
    const minFiled = group.reduce((m, u) => (u.filed! < m ? u.filed! : m), group[0].filed!);
    const originals = group.filter((u) => u.filed === minFiled);
    const rep = originals.slice().sort((a, b) => durationDays(a) - durationDays(b))[0];
    return {
      end,
      filed: minFiled,
      fy: rep.fy,
      fp: rep.fp,
      eps: typeof rep.val === "number" ? rep.val : null,
    };
  });

  events.sort((a, b) => (a.end < b.end ? -1 : a.end > b.end ? 1 : 0));
  return events
    .slice(-maxEvents)
    .reverse() // newest first
    .map((e) => ({
      symbol,
      fiscalPeriod: `${e.fy ?? "?"} ${e.fp ?? ""}`.trim(),
      reportDate: e.filed,
      epsActual: e.eps,
      raw: e,
    }));
}

export class FallbackProvider implements StockDataProvider {
  readonly name: ProviderName = "fallback";

  async getHistoricalKlines(symbol: string, interval = "1d"): Promise<Klines> {
    const sources: { name: string; closeOnly: boolean; run: () => Promise<Kline[]> }[] = [
      { name: "stockanalysis.com", closeOnly: true, run: () => fetchStockAnalysisHistory(symbol) },
      { name: "stooq.com", closeOnly: false, run: () => fetchStooqHistory(symbol) },
    ];
    const errors: string[] = [];
    for (const src of sources) {
      try {
        const bars = await src.run();
        assertBars(bars); // reject empty / NaN before returning
        return {
          symbol,
          interval,
          bars,
          raw: { source: src.name, rows: bars.length, closeOnly: src.closeOnly },
        };
      } catch (e) {
        errors.push(`${src.name}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    throw new Error(`all keyless price sources failed for ${symbol} → ${errors.join(" | ")}`);
  }

  async getQuote(symbol: string): Promise<Quote> {
    const { bars, raw } = await this.getHistoricalKlines(symbol);
    const last = bars[bars.length - 1];
    if (!last || !Number.isFinite(last.close) || last.close <= 0) {
      throw new Error(`no valid quote derivable for ${symbol}`);
    }
    return {
      symbol,
      price: last.close,
      currency: "USD",
      asOf: last.date,
      raw: {
        derivedFrom: (raw as { source?: string })?.source,
        note: "End-of-day close — the keyless fallback has no realtime quote.",
      },
    };
  }

  async getEarnings(symbol: string): Promise<Earnings> {
    const cik = await resolveCik(symbol);
    if (!cik) throw new Error(`no SEC CIK found for ${symbol}`);

    const fetchConcept = async (concept: string): Promise<EpsUnit[]> => {
      const data = await fetchJson<any>(
        `https://data.sec.gov/api/xbrl/companyconcept/CIK${cik}/us-gaap/${concept}.json`,
        { "User-Agent": SEC_UA },
      );
      return (data?.units?.["USD/shares"] ?? []) as EpsUnit[];
    };

    // Diluted preferred; fall back to basic if the concept is empty for this issuer.
    let units = await fetchConcept("EarningsPerShareDiluted").catch(() => [] as EpsUnit[]);
    let concept = "EarningsPerShareDiluted";
    if (units.length === 0) {
      units = await fetchConcept("EarningsPerShareBasic").catch(() => [] as EpsUnit[]);
      concept = "EarningsPerShareBasic";
    }

    // Up to ~20 unique fiscal-period events (several years back), newest first.
    const history = selectEarningsEvents(symbol, units, 20);
    const companyName = (await lookupTicker(symbol).catch(() => null))?.name;

    return {
      symbol,
      companyName,
      history,
      raw: {
        source: `SEC EDGAR XBRL (${concept})`,
        uniqueEvents: history.length,
        rawUnits: units.length,
      },
    };
  }

  async getEstimates(symbol: string): Promise<Estimates> {
    // Forward analyst estimates: no reliable keyless source. Honest null result.
    return {
      symbol,
      forwardEps: null,
      forwardPe: null,
      forwardRevenue: null,
      targetPriceMean: null,
      analystCount: null,
      consensusRating: null,
      raw: {
        available: false,
        note: "Forward estimates require the Bitget provider (or a keyed source). No keyless fallback.",
      },
    };
  }

  async getNews(symbol: string): Promise<News> {
    const cik = await resolveCik(symbol);
    if (!cik) throw new Error(`no SEC CIK found for ${symbol}`);
    const data = await fetchJson<any>(
      `https://data.sec.gov/submissions/CIK${cik}.json`,
      { "User-Agent": SEC_UA },
    );

    const FORM_DESC: Record<string, string> = {
      "8-K": "Material event reported by the company",
      "6-K": "Foreign issuer report",
      "10-Q": "Quarterly financial report",
      "10-K": "Annual report",
      "4": "Insider buy or sell",
      "3": "Insider ownership filing",
      "SC 13G": "Large shareholder position",
      "SC 13D": "Activist shareholder position",
      "DEF 14A": "Proxy statement",
    };
    const KEEP = /^(8-K|6-K|10-Q|10-K|4|3|SC 13G|SC 13D|DEF 14A)$/;

    const recent = data?.filings?.recent;
    const items: NewsItem[] = [];
    if (recent) {
      const { form, filingDate, accessionNumber, primaryDocument, primaryDocDescription } = recent;
      const cikNum = Number(cik);
      for (let i = 0; i < form.length && items.length < 12; i++) {
        const f = form[i] as string;
        if (!KEEP.test(f)) continue;
        const acc = accessionNumber[i].replace(/-/g, "");
        const url = `https://www.sec.gov/Archives/edgar/data/${cikNum}/${acc}/${primaryDocument[i]}`;
        items.push({
          title: `${f} filing`,
          summary: FORM_DESC[f] ?? primaryDocDescription[i] ?? "SEC filing",
          formType: f,
          url,
          source: "SEC EDGAR",
          publishedAt: filingDate[i],
        });
      }
    }
    return {
      symbol,
      items,
      raw: { source: "SEC EDGAR submissions (recent filings)", count: items.length },
    };
  }
}