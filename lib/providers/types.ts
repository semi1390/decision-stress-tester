/**
 * Normalized data types + the provider interface.
 *
 * Product code (analysis layer, API routes, UI) should depend ONLY on this
 * interface — never on a concrete provider. Swap Bitget for the fallback (or a
 * future provider) without touching anything downstream.
 *
 * Every shape carries an optional `raw` field holding the untouched upstream
 * payload, so you can inspect real responses (via `npm run probe`) and flesh
 * out the normalization once you've seen the actual field names.
 */

export type ProviderName = "bitget" | "fallback";

export interface Quote {
  symbol: string;
  price: number | null;
  currency?: string;
  asOf?: string; // ISO timestamp or date
  raw?: unknown;
}

export interface EarningsReport {
  symbol: string;
  fiscalPeriod?: string;
  reportDate?: string;
  epsActual?: number | null;
  epsEstimate?: number | null;
  revenueActual?: number | null;
  revenueEstimate?: number | null;
  surprisePct?: number | null;
  raw?: unknown;
}

export interface Earnings {
  symbol: string;
  companyName?: string;
  nextEarningsDate?: string | null;
  history: EarningsReport[];
  raw?: unknown;
}

export interface Estimates {
  symbol: string;
  forwardEps?: number | null;
  forwardPe?: number | null;
  forwardRevenue?: number | null;
  targetPriceMean?: number | null;
  analystCount?: number | null;
  consensusRating?: string | null;
  raw?: unknown;
}

export interface NewsItem {
  title: string;
  url?: string;
  source?: string;
  publishedAt?: string;
  summary?: string;
  formType?: string;
}

export interface News {
  symbol: string;
  items: NewsItem[];
  raw?: unknown;
}

export interface Kline {
  date: string; // ISO date
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface Klines {
  symbol: string;
  interval: string; // e.g. "1d"
  bars: Kline[];
  raw?: unknown;
}

export interface StockDataProvider {
  readonly name: ProviderName;
  getQuote(symbol: string): Promise<Quote>;
  getEarnings(symbol: string): Promise<Earnings>;
  getEstimates(symbol: string): Promise<Estimates>;
  getNews(symbol: string): Promise<News>;
  getHistoricalKlines(symbol: string, interval?: string): Promise<Klines>;
}