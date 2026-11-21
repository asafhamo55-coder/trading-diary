// Server-side data for the Trade guidelines: reads the config, derives
// holdings + cash from the Trade module, fetches quotes and runs the pure
// engine in guidelines.ts.
import { prisma } from "./db";
import { ensureGuidelineSchema } from "./guidelines-schema";
import {
  DEFAULT_GUIDELINE_CONFIG,
  deriveCash,
  derivePositions,
  evaluateGuidelines,
  parseGuidelineConfig,
  resolveCash,
  sumRealizedPnL,
  summarizeGuidelines,
  type GuidelineConfig,
  type GuidelineResult,
  type GuidelineSummary,
  type Position,
  type ResolvedCash,
  type TradeForHoldings,
} from "./guidelines";
import { getQuotes, type Quote } from "./market-data";

// ── Self-heal ──────────────────────────────────────────────────────

let schemaReady: Promise<void> | null = null;

function ensureReady(): Promise<void> {
  if (!schemaReady) {
    schemaReady = ensureGuidelineSchema().catch((e) => {
      schemaReady = null;
      throw e;
    });
  }
  return schemaReady;
}

/** Run a Prisma op; if it fails (table missing on a fresh deploy), heal and retry once. */
async function withHeal<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch {
    schemaReady = null;
    await ensureReady();
    return run();
  }
}

async function accountId(): Promise<string | null> {
  const account = await prisma.account.findFirst({ select: { id: true } });
  return account?.id ?? null;
}

// ── Config ─────────────────────────────────────────────────────────

export interface StoredGuidelineConfig {
  config: GuidelineConfig;
  /** ISO; null when nothing has been saved yet (defaults in use). */
  updatedAt: string | null;
}

export async function getGuidelineConfig(): Promise<StoredGuidelineConfig> {
  const acct = await accountId();
  if (!acct) return { config: structuredClone(DEFAULT_GUIDELINE_CONFIG), updatedAt: null };
  const row = await withHeal(() => prisma.tradingGuideline.findUnique({ where: { accountId: acct } }));
  if (!row) return { config: structuredClone(DEFAULT_GUIDELINE_CONFIG), updatedAt: null };
  return { config: parseGuidelineConfig(row.config), updatedAt: row.updatedAt.toISOString() };
}

/** `config` must already be validated (guidelineConfigSchema). */
export async function saveGuidelineConfig(config: GuidelineConfig): Promise<StoredGuidelineConfig> {
  const acct = await accountId();
  if (!acct) throw new Error("No trading account");
  const json = JSON.parse(JSON.stringify(config));
  const row = await withHeal(() =>
    prisma.tradingGuideline.upsert({
      where: { accountId: acct },
      create: { accountId: acct, config: json },
      update: { config: json },
    })
  );
  return { config: parseGuidelineConfig(row.config), updatedAt: row.updatedAt.toISOString() };
}

// ── Holdings ───────────────────────────────────────────────────────

export interface HoldingsSnapshot {
  positions: Position[];
  cash: ResolvedCash;
}

async function loadHoldings(config: GuidelineConfig): Promise<HoldingsSnapshot> {
  const account = await prisma.account.findFirst();
  if (!account) {
    return { positions: [], cash: resolveCash(null, config.cashOverride) };
  }
  const [trades, leverages] = await Promise.all([
    prisma.trade.findMany({
      where: { accountId: account.id },
      select: {
        symbol: true,
        direction: true,
        isCompleted: true,
        totalPnL: true,
        totalShares: true,
        sharesInProcess: true,
        entries: { select: { legType: true, price: true, quantity: true } },
      },
    }),
    prisma.assetLeverage.findMany({ where: { accountId: account.id } }).catch(() => []),
  ]);
  let netDeposits = 0;
  try {
    const agg = await prisma.fundTransaction.aggregate({ where: { accountId: account.id }, _sum: { amount: true } });
    netDeposits = agg._sum.amount ?? 0;
  } catch {
    // FundTransaction table may not exist pre-migration (same as getTradeEquity).
  }
  const rows = trades as TradeForHoldings[];
  const lev = Object.fromEntries(leverages.map((l) => [l.symbol.toUpperCase(), l.leverage]));
  const positions = derivePositions(rows, lev);
  const derived = deriveCash({
    startingBalance: account.startingBalance,
    realizedPnL: sumRealizedPnL(rows),
    netDeposits,
    positions,
  });
  return { positions, cash: resolveCash(derived, config.cashOverride) };
}

// ── Status ─────────────────────────────────────────────────────────

export interface DataFreshness {
  /** Oldest quote fetch time (ISO) — "prices as of". */
  oldestFetchedAt: string | null;
  /** Newest last-trade time reported by a source (ISO). */
  latestPriceAsOf: string | null;
  staleSymbols: string[];
  missingSymbols: string[];
  sources: string[];
}

export interface GuidelineStatusPayload {
  generatedAt: string;
  config: GuidelineConfig;
  configUpdatedAt: string | null;
  cash: ResolvedCash;
  result: GuidelineResult;
  quotes: Record<string, Quote>;
  freshness: DataFreshness;
}

export function describeFreshness(quotes: Record<string, Quote>): DataFreshness {
  const qs = Object.values(quotes);
  const fetched = qs.map((q) => q.fetchedAt).sort();
  const asOf = qs.map((q) => q.priceAsOf).filter((x): x is string => !!x).sort();
  const sources = new Set<string>();
  for (const q of qs) {
    if (q.source.price) sources.add(q.source.price === "yahoo" ? "Yahoo Finance" : "Nasdaq");
    if (q.source.marketCap) sources.add("Nasdaq");
  }
  return {
    oldestFetchedAt: fetched[0] ?? null,
    latestPriceAsOf: asOf[asOf.length - 1] ?? null,
    staleSymbols: qs.filter((q) => q.stale).map((q) => q.symbol),
    missingSymbols: qs.filter((q) => q.price == null).map((q) => q.symbol),
    sources: [...sources],
  };
}

/** Build the full status from already-loaded pieces (also used by the mock). */
export function buildStatus(
  config: GuidelineConfig,
  configUpdatedAt: string | null,
  holdings: HoldingsSnapshot,
  quotes: Record<string, Quote>
): GuidelineStatusPayload {
  const result = evaluateGuidelines({ positions: holdings.positions, cash: holdings.cash.amount, quotes, config });
  return {
    generatedAt: new Date().toISOString(),
    config,
    configUpdatedAt,
    cash: holdings.cash,
    result,
    quotes,
    freshness: describeFreshness(quotes),
  };
}

/** Throws only when the database is unreachable; market-data failures degrade. */
export async function getGuidelineStatus(): Promise<GuidelineStatusPayload> {
  const { config, updatedAt } = await getGuidelineConfig();
  const holdings = await loadHoldings(config);
  const symbols = [
    config.sp500Symbol,
    config.nasdaqSymbol,
    ...holdings.positions.map((p) => p.symbol),
    ...config.watchlist,
  ];
  const quotes = await getQuotes(symbols);
  return buildStatus(config, updatedAt, holdings, quotes);
}

/**
 * Hook for the household advisor: a compact, USD guideline status. Never
 * throws (null when the trade data can't be read). To include it, add
 * `guidelines: await getGuidelineSummary()` to the advisor snapshot.
 */
export async function getGuidelineSummary(): Promise<GuidelineSummary | null> {
  try {
    const status = await getGuidelineStatus();
    return summarizeGuidelines(status.result);
  } catch {
    return null;
  }
}
