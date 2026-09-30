# Reckon

AI research workbench that stress-tests a stock trade idea against history and
base rates **before** you act on it — clear-eyed research that challenges the
trade rather than cheerleading it. The human makes the final call.

Built for **Bitget AI Base Camp Hackathon S2 — AI Trading Desk track**
(sub-theme: Decision Stress Testing).

> **This is the foundation scaffold (Prompt 2).** It ships the project shell +
> a swappable data layer + a connectivity probe. **No analysis logic yet** —
> that's the next step.

---

## What's in here

```
app/
  layout.tsx
  page.tsx                    # placeholder homepage: trade-idea input → raw data
  globals.css
  api/stress-test/route.ts    # STUB API route: fetches raw data, no analysis
lib/
  providers/
    types.ts                  # StockDataProvider interface + normalized types
    bitget.ts                 # BitgetProvider — MCP client (agent.bitget.com/mcp)
    fallback.ts               # FallbackProvider — keyless (Stooq + SEC EDGAR)
    index.ts                  # createDataProvider() factory + ResilientProvider
    logger.ts
scripts/
  probe.ts                    # `npm run probe` — reachability + real data shapes
```

### The data layer (the important part)

Product code depends **only** on the `StockDataProvider` interface
(`getQuote`, `getEarnings`, `getEstimates`, `getNews`, `getHistoricalKlines`).
Two implementations sit behind it:

- **`BitgetProvider`** — connects to `bitget-mcp-server` over MCP Streamable
  HTTP at `https://agent.bitget.com/mcp` (no API key). It **discovers the tool
  list at connect time** and matches methods to tools by name pattern, because
  the handbook documents data *categories*, not exact tool names. Run the probe
  to see the real names, then tighten the normalization.
- **`FallbackProvider`** — keyless public sources so the app works even if
  Bitget is unreachable: **Stooq** (EOD OHLCV → quotes + klines) and
  **SEC EDGAR** (EPS history + recent 8-K/6-K filings as news). Forward analyst
  estimates have no reliable keyless source, so the fallback reports that
  honestly (Bitget is primary for estimates).

`createDataProvider()` returns a **`ResilientProvider`** that tries Bitget
first and falls back automatically — per call — logging which provider served
each request (`[data] getQuote(NVDA) served via bitget|fallback`).

To swap in a new provider later, implement `StockDataProvider` and wire it into
`lib/providers/index.ts`. Nothing else changes.

---

## Prerequisites

- **Node.js ≥ 20**
- npm (or pnpm/yarn)

## Setup

```bash
npm install
cp .env.example .env.local   # optional — the data layer works with no keys
```

`.env.local` values are all optional:

| Var | Purpose | Needed? |
| --- | --- | --- |
| `BITGET_MCP_URL` | Bitget MCP endpoint | No (defaults to the official URL) |
| `SEC_USER_AGENT` | SEC EDGAR asks for a descriptive UA + contact email | Recommended for the fallback |
| `QWEN_API_KEY` | **Qwen key for the analysis layer** (also accepts `DASHSCOPE_API_KEY`) | **Yes — for `/api/analyze`** |
| `QWEN_BASE_URL` | Qwen OpenAI-compatible base URL | No (defaults to the Bitget hackathon proxy) |
| `QWEN_MODEL` | Qwen model id | No (defaults to `qwen3.8-max`) |

### Qwen (analysis LLM)

The analysis layer calls **Qwen** through its **OpenAI-compatible endpoint** (via the
`openai` SDK). Two ways to point it:

- **Bitget hackathon proxy (default)** — where your S2 credits live:
  `QWEN_BASE_URL=https://hackathon.bitgetops.com/v1`, `QWEN_MODEL=qwen3.8-max`.
- **Alibaba DashScope directly** — a Model Studio key:
  `QWEN_BASE_URL=https://dashscope-intl.aliyuncs.com/compatible-mode/v1` (Singapore/intl;
  Beijing and US-Virginia variants exist), `QWEN_MODEL=qwen3.8-max` (or `qwen-plus`).
  DashScope's standard key env var is `DASHSCOPE_API_KEY`, which this app also reads.

## 1. Run the connectivity probe first

```bash
npm run probe            # defaults to NVDA
npm run probe TSLA       # any US ticker
```

This connects to the Bitget MCP endpoint, prints the **real tool names + input
schemas**, pulls NVDA sample data (raw shape), then runs the resilient provider
to confirm the fallback works. If Bitget is unreachable it says so and proves
the keyless fallback still returns data.

**Do this before building product logic** — it confirms reachability from your
machine and shows you the exact fields to normalize against.

## 2. Run the dev server

```bash
npm run dev              # http://localhost:3000
```

Type a trade idea (e.g. **"NVDA beat earnings, thinking of buying the pop"**) and click
**Analyze**. You'll see a structured readout for the extracted ticker:

- **header** — ticker, direction (long/short/unclear), latest price, restated thesis
- **What actually happened** — a plain-English, factual synthesis from Qwen
- **Latest earnings** — reported EPS + filing date; a **beat/miss** badge **only if a
  consensus estimate is actually present** (the keyless fallback has none, so it shows
  "reported results only — no beat/miss claimed")
- **Forward estimates** — shown only when available (Bitget)
- **Recent news / filings** — from SEC EDGAR (fallback) or Bitget
- **Data notes** — explicit limitations (e.g. "consensus estimates unavailable")

Requires `QWEN_API_KEY` in `.env.local`. Without it, `/api/analyze` returns a clear
"Qwen API key not set" message rather than failing silently.

### What the analysis layer does (this stage)

`app/api/analyze` → `lib/analysis/analyze.ts`:
1. `lib/analysis/extract.ts` — Qwen extracts the **ticker + direction + thesis** from the idea.
2. Pulls **earnings, news, estimates, quote** via the existing `StockDataProvider`.
3. Computes **beat/miss only when a consensus EPS is present** — never invented.
4. `lib/llm/qwen.ts` — Qwen synthesizes the **"what actually happened"** readout.
5. Returns structured JSON; the page renders it.

> Not built yet (later prompts): the base-rate / historical-analog engine, the
> "challenge the trade" stress-test logic, and the final brief format.

---

## Deploy to Vercel (later)

This is a standard Next.js App Router app — deployable as-is:

```bash
# push to GitHub, then "Import Project" on Vercel, or:
npx vercel
```

Add the same env vars in the Vercel dashboard. The API route is pinned to the
Node.js runtime (`runtime = "nodejs"`) because the MCP SDK needs Node, not Edge.
**Verify the Bitget endpoint is reachable from Vercel's region** — the fallback
covers you if it isn't.

---

## Notes / known gaps (by design at this stage)

- **Tool-name matching is best-effort** until the probe reveals real names.
  The `raw` field on every result holds the untouched upstream payload so you
  can flesh out `normalize*` mappings in `bitget.ts`.
- **No analysis / LLM logic yet** — the API route only returns raw data.
- **Fallback estimates are intentionally null** — no keyless source exists for
  forward analyst estimates; Bitget is primary there.
- **Ticker extraction is a placeholder regex** — real (LLM) extraction lands
  with the analysis layer.