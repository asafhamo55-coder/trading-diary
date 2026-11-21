// Free, key-less market data for the Trade guidelines: current price,
// 3-month high and market cap per symbol.
//
// Sources (both public JSON, no API key; both want a browser User-Agent):
//   1. Yahoo Finance chart — query1.finance.yahoo.com/v8/finance/chart/{SYM}?range=3mo&interval=1d
//      One call gives price, instrument type (EQUITY / ETF) and the daily
//      highs. Yahoo rate-limits some IPs (HTTP 429); after a 429 it is
//      skipped for a while (circuit breaker) and Nasdaq is used instead.
//   2. Nasdaq — api.nasdaq.com/api/quote/{SYM}/info | /historical | /summary
//      info → last sale price + asset class; historical → daily highs;
//      summary → market cap (the only free key-less market-cap source that
//      worked without a crumb/cookie).
//
// The parse* functions are pure and unit-tested against fixtures. The fetch
// layer never throws: failures come back as a Quote with nulls + `error`.
// Caching (≈15 min in market hours, 60 min otherwise) uses Next's
// unstable_cache (cacheComponents is not enabled in this app, so `use cache`
// is unavailable), plus an in-memory last-good copy to serve stale data
// when a refresh fails.

export type InstrumentKind = "etf" | "stock" | "unknown";

export interface Quote {
  symbol: string;
  name: string | null;
  kind: InstrumentKind;
  /** Latest price (delayed). */
  price: number | null;
  /** Highest daily high over the last ~3 months. */
  high3m: number | null;
  /** USD. Null for ETFs (not needed) or when unknown. */
  marketCap: number | null;
  /** When the price was last traded (ISO), if the source says. */
  priceAsOf: string | null;
  /** When this quote was fetched (ISO). */
  fetchedAt: string;
  /** Which source supplied the price / market cap. */
  source: { price: "yahoo" | "nasdaq" | null; marketCap: "nasdaq" | null };
  /** True when served from the last good copy after a failed refresh. */
  stale: boolean;
  /** Human note when something is missing. */
  error: string | null;
}

export interface PriceHistory {
  name: string | null;
  kind: InstrumentKind;
  price: number | null;
  high3m: number | null;
  priceAsOf: string | null;
}

// ── Pure parsers ────────────────────────────────────────────────────

/** "$1,234.56" / "608.45" / "3,093,823,040,000" → number; "N/A" / "" → null. */
export function parseMoney(raw: unknown): number | null {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  if (typeof raw !== "string") return null;
  const cleaned = raw.replace(/[$,\s]/g, "");
  if (!cleaned || !/^-?\d+(\.\d+)?$/.test(cleaned)) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function finiteMax(values: unknown[]): number | null {
  let best: number | null = null;
  for (const v of values) {
    if (typeof v === "number" && Number.isFinite(v) && v > 0 && (best == null || v > best)) best = v;
  }
  return best;
}

function kindFromYahoo(t: unknown): InstrumentKind {
  if (t === "ETF") return "etf";
  if (t === "EQUITY") return "stock";
  return "unknown";
}

function kindFromNasdaq(t: unknown): InstrumentKind {
  if (typeof t !== "string") return "unknown";
  const u = t.toUpperCase();
  if (u === "ETF") return "etf";
  if (u === "STOCKS" || u === "STOCK") return "stock";
  return "unknown";
}

/** Yahoo v8 chart JSON → price, 3-month high, kind. Null when unusable. */
export function parseYahooChart(json: unknown): PriceHistory | null {
  const result = (json as { chart?: { result?: unknown[] | null } } | null)?.chart?.result;
  if (!Array.isArray(result) || result.length === 0) return null;
  const r = result[0] as {
    meta?: Record<string, unknown>;
    indicators?: { quote?: { high?: unknown[]; close?: unknown[] }[] };
  };
  const meta = r.meta ?? {};
  const q = r.indicators?.quote?.[0];
  const highs = Array.isArray(q?.high) ? q!.high! : [];
  const closes = Array.isArray(q?.close) ? q!.close! : [];
  const lastClose = [...closes].reverse().find((c) => typeof c === "number" && Number.isFinite(c)) as
    | number
    | undefined;
  const metaPrice = typeof meta.regularMarketPrice === "number" ? meta.regularMarketPrice : null;
  const price = metaPrice ?? lastClose ?? null;
  // Include today's price in case today's bar is still forming.
  const high3m = finiteMax([...highs, price]);
  const t = typeof meta.regularMarketTime === "number" ? meta.regularMarketTime : null;
  const name =
    (typeof meta.longName === "string" && meta.longName) ||
    (typeof meta.shortName === "string" && meta.shortName) ||
    null;
  if (price == null && high3m == null) return null;
  return {
    name,
    kind: kindFromYahoo(meta.instrumentType),
    price,
    high3m,
    priceAsOf: t ? new Date(t * 1000).toISOString() : null,
  };
}

interface NasdaqEnvelope<T> {
  data?: T | null;
  status?: { rCode?: number };
}

function nasdaqData<T>(json: unknown): T | null {
  const env = json as NasdaqEnvelope<T> | null;
  if (!env || typeof env !== "object") return null;
  if (env.status?.rCode != null && env.status.rCode !== 200) return null;
  return env.data ?? null;
}

/** Nasdaq /info → last sale price, kind, name. */
export function parseNasdaqInfo(json: unknown): { price: number | null; kind: InstrumentKind; name: string | null; priceAsOf: string | null } | null {
  const d = nasdaqData<{
    companyName?: string;
    assetClass?: string;
    primaryData?: { lastSalePrice?: string; lastTradeTimestamp?: string };
  }>(json);
  if (!d) return null;
  const ts = d.primaryData?.lastTradeTimestamp;
  const parsed = ts ? Date.parse(ts.replace(/^.*?(\w{3} \d{1,2}, \d{4}).*$/, "$1")) : NaN;
  return {
    price: parseMoney(d.primaryData?.lastSalePrice),
    kind: kindFromNasdaq(d.assetClass),
    name: d.companyName ?? null,
    priceAsOf: Number.isFinite(parsed) ? new Date(parsed).toISOString() : null,
  };
}

/** Nasdaq /historical → max daily high and latest close. */
export function parseNasdaqHistorical(json: unknown): { high3m: number | null; lastClose: number | null; lastDate: string | null } | null {
  const d = nasdaqData<{ tradesTable?: { rows?: { date?: string; close?: string; high?: string }[] | null } }>(json);
  const rows = d?.tradesTable?.rows;
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const high3m = finiteMax(rows.map((r) => parseMoney(r.high)));
  // Rows are newest first.
  const lastClose = parseMoney(rows[0]?.close);
  const lastDateMs = rows[0]?.date ? Date.parse(rows[0].date) : NaN;
  return { high3m, lastClose, lastDate: Number.isFinite(lastDateMs) ? new Date(lastDateMs).toISOString() : null };
}

/** Nasdaq /summary → market cap (USD) and asset class. */
export function parseNasdaqSummary(json: unknown): { marketCap: number | null; kind: InstrumentKind } | null {
  const d = nasdaqData<{ assetClass?: string; summaryData?: { MarketCap?: { value?: string } } }>(json);
  if (!d) return null;
  return { marketCap: parseMoney(d.summaryData?.MarketCap?.value), kind: kindFromNasdaq(d.assetClass) };
}

/**
 * Regular US session (Mon–Fri 9:30–16:00 America/New_York). Holidays are
 * ignored — on a holiday we just refresh a bit more often than needed.
 */
export function isUsMarketHours(now: Date = new Date()): boolean {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const wd = get("weekday");
  if (wd === "Sat" || wd === "Sun") return false;
  const mins = Number(get("hour")) * 60 + Number(get("minute"));
  return mins >= 9 * 60 + 30 && mins < 16 * 60;
}

/** Cache lifetime in seconds: 15 min while the market is open, 60 min otherwise. */
export function quoteTtlSeconds(now: Date = new Date()): number {
  return isUsMarketHours(now) ? 15 * 60 : 60 * 60;
}

/** Normalise and validate a ticker ("brk.b" → "BRK.B"); null if implausible. */
export function normalizeSymbol(raw: string): string | null {
  const s = raw.trim().toUpperCase();
  return /^[A-Z][A-Z0-9.\-]{0,9}$/.test(s) ? s : null;
}

// ── Fetch layer (server only) ──────────────────────────────────────

const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";
const TIMEOUT_MS = 6000;
const YAHOO_COOLDOWN_MS = 10 * 60 * 1000;

let yahooBlockedUntil = 0;

async function getJson(url: string): Promise<{ status: number; json: unknown }> {
  const res = await fetch(url, {
    headers: { "User-Agent": BROWSER_UA, Accept: "application/json, text/plain, */*", "Accept-Language": "en-US,en;q=0.9" },
    cache: "no-store",
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    // non-JSON body ("Too Many Requests")
  }
  return { status: res.status, json };
}

async function fromYahoo(symbol: string): Promise<PriceHistory | null> {
  if (Date.now() < yahooBlockedUntil) return null;
  try {
    const { status, json } = await getJson(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=3mo&interval=1d`
    );
    if (status === 429) {
      yahooBlockedUntil = Date.now() + YAHOO_COOLDOWN_MS;
      return null;
    }
    return status === 200 ? parseYahooChart(json) : null;
  } catch {
    return null;
  }
}

const nasdaqUrl = (symbol: string, path: string, cls: "stocks" | "etf", extra = "") =>
  `https://api.nasdaq.com/api/quote/${encodeURIComponent(symbol)}/${path}?assetclass=${cls}${extra}`;

async function nasdaq<T>(url: string, parse: (j: unknown) => T | null): Promise<T | null> {
  try {
    const { status, json } = await getJson(url);
    return status === 200 ? parse(json) : null;
  } catch {
    return null;
  }
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

async function fromNasdaqHistory(symbol: string, hint: InstrumentKind): Promise<PriceHistory | null> {
  const classes: ("stocks" | "etf")[] = hint === "etf" ? ["etf", "stocks"] : ["stocks", "etf"];
  for (const cls of classes) {
    const info = await nasdaq(nasdaqUrl(symbol, "info", cls), parseNasdaqInfo);
    if (!info) continue;
    const to = new Date();
    const from = new Date(to.getTime() - 92 * 86400_000);
    const hist = await nasdaq(
      nasdaqUrl(symbol, "historical", cls, `&fromdate=${isoDate(from)}&todate=${isoDate(to)}&limit=100`),
      parseNasdaqHistorical
    );
    const price = info.price ?? hist?.lastClose ?? null;
    return {
      name: info.name,
      kind: info.kind !== "unknown" ? info.kind : cls === "etf" ? "etf" : "stock",
      price,
      high3m: finiteMax([hist?.high3m ?? null, price]),
      priceAsOf: info.priceAsOf ?? hist?.lastDate ?? null,
    };
  }
  return null;
}

async function marketCapFromNasdaq(symbol: string, hint: InstrumentKind): Promise<{ marketCap: number | null; kind: InstrumentKind } | null> {
  const classes: ("stocks" | "etf")[] = hint === "etf" ? ["etf"] : ["stocks", "etf"];
  for (const cls of classes) {
    const s = await nasdaq(nasdaqUrl(symbol, "summary", cls), parseNasdaqSummary);
    if (s) return { marketCap: s.marketCap, kind: s.kind !== "unknown" ? s.kind : cls === "etf" ? "etf" : "stock" };
  }
  return null;
}

/** One uncached lookup. Never throws. */
export async function fetchQuoteUncached(symbol: string): Promise<Quote> {
  const fetchedAt = new Date().toISOString();
  let hist = await fromYahoo(symbol);
  let priceSource: Quote["source"]["price"] = hist?.price != null ? "yahoo" : null;
  if (!hist || hist.price == null || hist.high3m == null) {
    const nq = await fromNasdaqHistory(symbol, hist?.kind ?? "unknown");
    if (nq && nq.price != null) {
      hist = { ...nq, name: hist?.name ?? nq.name, kind: hist?.kind && hist.kind !== "unknown" ? hist.kind : nq.kind };
      priceSource = "nasdaq";
    }
  }
  let kind: InstrumentKind = hist?.kind ?? "unknown";
  let marketCap: number | null = null;
  let capSource: Quote["source"]["marketCap"] = null;
  if (kind !== "etf") {
    const cap = await marketCapFromNasdaq(symbol, kind);
    if (cap) {
      if (kind === "unknown") kind = cap.kind;
      if (kind !== "etf" && cap.marketCap != null) {
        marketCap = cap.marketCap;
        capSource = "nasdaq";
      }
    }
  }
  const missing: string[] = [];
  if (hist?.price == null) missing.push("price");
  if (hist?.high3m == null) missing.push("3-month high");
  if (kind === "stock" && marketCap == null) missing.push("market cap");
  return {
    symbol,
    name: hist?.name ?? null,
    kind,
    price: hist?.price ?? null,
    high3m: hist?.high3m ?? null,
    marketCap,
    priceAsOf: hist?.priceAsOf ?? null,
    fetchedAt,
    source: { price: priceSource, marketCap: capSource },
    stale: false,
    error: missing.length ? `No ${missing.join(", ")} from Yahoo or Nasdaq` : null,
  };
}

const lastGood = new Map<string, Quote>();

/** A quote is worth caching only when it has a price. */
function usable(q: Quote): boolean {
  return q.price != null;
}

async function cachedLookup(symbol: string, ttl: number): Promise<Quote> {
  // Imported lazily so the pure parsers above stay importable in tests.
  const { unstable_cache } = await import("next/cache");
  const run = unstable_cache(
    async (sym: string) => {
      const q = await fetchQuoteUncached(sym);
      // Throwing keeps a failed lookup out of the cache.
      if (!usable(q)) throw Object.assign(new Error("quote unavailable"), { quote: q });
      return q;
    },
    ["guidelines-quote-v1", String(ttl)],
    { revalidate: ttl, tags: ["market-quotes"] }
  );
  return run(symbol);
}

/**
 * Quote for one symbol: cached ~15 min in market hours, last good copy
 * (marked stale) when a refresh fails, otherwise a Quote full of nulls.
 */
export async function getQuote(symbol: string): Promise<Quote> {
  const ttl = quoteTtlSeconds();
  try {
    let q: Quote;
    try {
      q = await cachedLookup(symbol, ttl);
    } catch (e) {
      const failed = (e as { quote?: Quote }).quote;
      // Outside a Next request context (scripts) unstable_cache can throw; fetch directly.
      q = failed ?? (await fetchQuoteUncached(symbol));
    }
    if (usable(q)) {
      lastGood.set(symbol, q);
      return q;
    }
    const prev = lastGood.get(symbol);
    return prev ? { ...prev, stale: true, error: "Refresh failed — showing the last good quote" } : q;
  } catch {
    const prev = lastGood.get(symbol);
    if (prev) return { ...prev, stale: true, error: "Refresh failed — showing the last good quote" };
    return emptyQuote(symbol, "Market data unavailable");
  }
}

export function emptyQuote(symbol: string, error: string | null = null): Quote {
  return {
    symbol,
    name: null,
    kind: "unknown",
    price: null,
    high3m: null,
    marketCap: null,
    priceAsOf: null,
    fetchedAt: new Date().toISOString(),
    source: { price: null, marketCap: null },
    stale: false,
    error,
  };
}

/** Quotes for many symbols (deduped, a few at a time to be polite). */
export async function getQuotes(symbols: string[]): Promise<Record<string, Quote>> {
  const unique = [...new Set(symbols.map((s) => normalizeSymbol(s)).filter((s): s is string => !!s))];
  const out: Record<string, Quote> = {};
  const CONCURRENCY = 4;
  for (let i = 0; i < unique.length; i += CONCURRENCY) {
    const batch = unique.slice(i, i + CONCURRENCY);
    const quotes = await Promise.all(batch.map((s) => getQuote(s)));
    batch.forEach((s, j) => (out[s] = quotes[j]));
  }
  return out;
}
