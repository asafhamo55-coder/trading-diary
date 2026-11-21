// Trading guidelines: the house rules for the stocks account and the engine
// that says what to do to get back to them. Pure (no Prisma, no fetch) so it
// is fully unit-tested; guidelines-data.ts feeds it real holdings + quotes.
//
// The rules (all editable, stored per Account in TradingGuideline.config):
//   • Targets as a share of total account value (positions at market + cash):
//     S&P 500 ETF 30%, Nasdaq ETF 20%, large-cap single stocks 25%, cash 25%.
//   • Only `sp500Symbol` (SPY) counts as the S&P 500 bucket and only
//     `nasdaqSymbol` (QQQ) as the Nasdaq bucket. Any other ETF is outside the
//     rules, as is a single stock below `largeCapMinUsd` ($100B), a short or a
//     leveraged position.
//   • Rebalance band: trades are suggested only when some bucket is more than
//     `bandPct` (5) percentage points off target, or a position is outside
//     the rules.
//   • Dip rule: a held large cap (or watchlist name) ≥ `dipPct` (10%) below
//     its 3-month high is a dip signal; each suggests deploying
//     `deployFraction` (1/3) of the remaining cash reserve into it, capped so
//     large caps stay ≤ target + band. Then refill the reserve.
import { z } from "zod";

// ── Config ─────────────────────────────────────────────────────────

export type BucketId = "sp500" | "nasdaq" | "largeCap" | "cash";
export const BUCKET_IDS: BucketId[] = ["sp500", "nasdaq", "largeCap", "cash"];

export interface CashOverride {
  /** USD cash balance as the broker shows it. */
  amount: number;
  /** YYYY-MM-DD. */
  asOf: string;
}

export interface GuidelineConfig {
  version: 1;
  /** Percent of total account value; must sum to 100. */
  targets: Record<BucketId, number>;
  sp500Symbol: string;
  nasdaqSymbol: string;
  /** Percentage points a bucket may drift before trades are suggested. */
  bandPct: number;
  /** % below the 3-month high that counts as a dip. */
  dipPct: number;
  /** Fraction (0–1) of the remaining cash reserve each dip signal deploys. */
  deployFraction: number;
  /** USD market cap a single stock needs to count as large cap. */
  largeCapMinUsd: number;
  /** Extra large caps to watch for dips (not necessarily held). */
  watchlist: string[];
  /** Manual cash figure; null = derive cash from the Trade module. */
  cashOverride: CashOverride | null;
}

export const DEFAULT_GUIDELINE_CONFIG: GuidelineConfig = {
  version: 1,
  targets: { sp500: 30, nasdaq: 20, largeCap: 25, cash: 25 },
  sp500Symbol: "SPY",
  nasdaqSymbol: "QQQ",
  bandPct: 5,
  dipPct: 10,
  deployFraction: 1 / 3,
  largeCapMinUsd: 100_000_000_000,
  watchlist: [],
  cashOverride: null,
};

const ticker = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z][A-Z0-9.\-]{0,9}$/, "Not a valid ticker");

const pct = z.number().finite().min(0).max(100);

export const guidelineConfigSchema = z
  .object({
    version: z.literal(1).default(1),
    targets: z.object({ sp500: pct, nasdaq: pct, largeCap: pct, cash: pct }),
    sp500Symbol: ticker,
    nasdaqSymbol: ticker,
    bandPct: z.number().finite().min(0.5).max(50),
    dipPct: z.number().finite().min(1).max(90),
    deployFraction: z.number().finite().min(0.01).max(1),
    largeCapMinUsd: z.number().finite().min(0),
    watchlist: z.array(ticker).max(50).transform((l) => [...new Set(l)]),
    cashOverride: z
      .object({
        amount: z.number().finite(),
        asOf: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD"),
      })
      .nullable(),
  })
  .superRefine((c, ctx) => {
    const sum = BUCKET_IDS.reduce((s, b) => s + c.targets[b], 0);
    if (Math.abs(sum - 100) > 0.01) {
      ctx.addIssue({ code: "custom", path: ["targets"], message: `Targets must sum to 100% (now ${round2(sum)}%)` });
    }
    if (c.sp500Symbol === c.nasdaqSymbol) {
      ctx.addIssue({ code: "custom", path: ["nasdaqSymbol"], message: "S&P 500 and Nasdaq ETFs must differ" });
    }
  });

/**
 * Stored JSON → a valid config. Missing or invalid fields fall back to the
 * defaults (so a config saved by an older version still loads).
 */
export function parseGuidelineConfig(raw: unknown): GuidelineConfig {
  const base = DEFAULT_GUIDELINE_CONFIG;
  if (!raw || typeof raw !== "object") return structuredClone(base);
  const r = raw as Partial<GuidelineConfig>;
  const merged = {
    ...base,
    ...r,
    version: 1 as const,
    targets: { ...base.targets, ...(r.targets ?? {}) },
    watchlist: Array.isArray(r.watchlist) ? r.watchlist : base.watchlist,
    cashOverride: r.cashOverride ?? null,
  };
  const parsed = guidelineConfigSchema.safeParse(merged);
  return parsed.success ? (parsed.data as GuidelineConfig) : structuredClone(base);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ── Holdings + cash from the Trade module ──────────────────────────

export interface TradeLegLite {
  legType: "BUY" | "SELL";
  price: number;
  quantity: number;
}

export interface TradeForHoldings {
  symbol: string;
  direction: "LONG" | "SHORT";
  isCompleted: boolean;
  totalPnL: number | null;
  totalShares: number | null;
  sharesInProcess: number | null;
  entries: TradeLegLite[];
}

export interface Position {
  symbol: string;
  /** Net shares; negative = short. */
  shares: number;
  /** Average entry price of the open shares. */
  avgCost: number;
  /** |shares| × avgCost. */
  costBasis: number;
  /** From AssetLeverage; 1 = unleveraged. */
  leverage: number;
  tradeCount: number;
}

/**
 * Same rule as the dashboard / net worth (data.ts `hasRealizedPnL`,
 * savings-data.ts `getTradeEquity`): completed trades plus partially closed
 * open trades carry realized P&L in `totalPnL`.
 */
export function hasRealizedPnL(t: Pick<TradeForHoldings, "isCompleted" | "totalShares" | "sharesInProcess">): boolean {
  if (t.isCompleted) return true;
  const total = t.totalShares ?? 0;
  return total > 0 && (t.sharesInProcess ?? 0) < total;
}

export function sumRealizedPnL(trades: TradeForHoldings[]): number {
  return trades.reduce((s, t) => (t.totalPnL != null && hasRealizedPnL(t) ? s + t.totalPnL : s), 0);
}

/**
 * Open positions from incomplete trades: per trade, open qty = buys − sells
 * (LONG) or sells − buys (SHORT) at the trade's average entry price (avg buy
 * for longs, avg sell for shorts — the same price `calculatePnL` uses).
 * Trades on the same symbol are netted with a quantity-weighted average cost.
 */
export function derivePositions(trades: TradeForHoldings[], leverages: Record<string, number> = {}): Position[] {
  const acc = new Map<string, { long: number; longCost: number; short: number; shortCost: number; n: number }>();
  for (const t of trades) {
    if (t.isCompleted) continue;
    const sym = t.symbol.trim().toUpperCase();
    let buyQty = 0;
    let buyVal = 0;
    let sellQty = 0;
    let sellVal = 0;
    for (const l of t.entries) {
      if (!(l.quantity > 0)) continue;
      if (l.legType === "BUY") {
        buyQty += l.quantity;
        buyVal += l.quantity * l.price;
      } else {
        sellQty += l.quantity;
        sellVal += l.quantity * l.price;
      }
    }
    const a = acc.get(sym) ?? { long: 0, longCost: 0, short: 0, shortCost: 0, n: 0 };
    if (t.direction === "LONG") {
      const open = buyQty - sellQty;
      if (open > 1e-9 && buyQty > 0) {
        a.long += open;
        a.longCost += open * (buyVal / buyQty);
      }
    } else {
      const open = sellQty - buyQty;
      if (open > 1e-9 && sellQty > 0) {
        a.short += open;
        a.shortCost += open * (sellVal / sellQty);
      }
    }
    a.n += 1;
    acc.set(sym, a);
  }
  const out: Position[] = [];
  for (const [symbol, a] of acc) {
    const lev = leverages[symbol] ?? 1;
    // Longs and shorts in the same symbol are reported separately.
    if (a.long > 1e-9) {
      out.push({ symbol, shares: a.long, avgCost: a.longCost / a.long, costBasis: a.longCost, leverage: lev, tradeCount: a.n });
    }
    if (a.short > 1e-9) {
      out.push({ symbol, shares: -a.short, avgCost: a.shortCost / a.short, costBasis: a.shortCost, leverage: lev, tradeCount: a.n });
    }
  }
  return out.sort((x, y) => y.costBasis - x.costBasis);
}

export interface CashBreakdown {
  startingBalance: number;
  realizedPnL: number;
  netDeposits: number;
  /** Cost of open long positions (cash spent). */
  openLongCost: number;
  /** Proceeds of open short positions (cash received). */
  openShortProceeds: number;
  cash: number;
}

/**
 * Cash = starting balance + realized P&L + net deposits/withdrawals
 *        − cost basis of open longs + proceeds of open shorts.
 *
 * Equivalent to the dashboard's "current portfolio" (starting balance +
 * realized P&L) and net worth's trade equity (+ FundTransaction sum), minus
 * what is tied up in open positions at cost.
 */
export function deriveCash(input: {
  startingBalance: number;
  realizedPnL: number;
  netDeposits: number;
  positions: Position[];
}): CashBreakdown {
  const openLongCost = input.positions.filter((p) => p.shares > 0).reduce((s, p) => s + p.costBasis, 0);
  const openShortProceeds = input.positions.filter((p) => p.shares < 0).reduce((s, p) => s + p.costBasis, 0);
  return {
    startingBalance: input.startingBalance,
    realizedPnL: input.realizedPnL,
    netDeposits: input.netDeposits,
    openLongCost,
    openShortProceeds,
    cash: input.startingBalance + input.realizedPnL + input.netDeposits - openLongCost + openShortProceeds,
  };
}

export interface ResolvedCash {
  amount: number;
  source: "derived" | "override";
  asOf: string | null;
  derived: CashBreakdown | null;
}

export function resolveCash(derived: CashBreakdown | null, override: CashOverride | null): ResolvedCash {
  if (override) return { amount: override.amount, source: "override", asOf: override.asOf, derived };
  return { amount: derived?.cash ?? 0, source: "derived", asOf: null, derived };
}

// ── Engine ─────────────────────────────────────────────────────────

/** The quote fields the engine reads (a subset of market-data `Quote`). */
export interface QuoteLite {
  price: number | null;
  high3m: number | null;
  marketCap: number | null;
  kind: "etf" | "stock" | "unknown";
  name?: string | null;
}

export type Placement = BucketId | "outside";

export interface ClassifiedPosition {
  symbol: string;
  shares: number;
  avgCost: number;
  price: number | null;
  /** "cost" when no live price — valued at average cost. */
  priceSource: "market" | "cost";
  value: number;
  pctOfTotal: number;
  bucket: Exclude<Placement, "cash">;
  outsideReason: string | null;
  /** Counted as large cap, but the market cap couldn't be checked. */
  capUnverified: boolean;
  marketCap: number | null;
}

export type BucketState = "ok" | "over" | "under";

export interface BucketStatus {
  id: BucketId;
  label: string;
  targetPct: number;
  actualPct: number;
  targetValue: number;
  actualValue: number;
  /** actualPct − targetPct (percentage points). */
  driftPct: number;
  driftValue: number;
  status: BucketState;
  symbols: string[];
}

export type ActionKind = "exit" | "trim" | "buy" | "dip-buy" | "deposit" | "hold-cash" | "refill";

export interface GuidelineAction {
  id: string;
  kind: ActionKind;
  bucket: Placement;
  /** Null for bucket-level actions with no single symbol. */
  symbol: string | null;
  /** USD, always positive. */
  amount: number;
  /** Approximate share count (rounded); null when there is no price. */
  shares: number | null;
  price: number | null;
  /** Why — one short sentence. */
  reason: string;
}

export interface DipSignal {
  symbol: string;
  held: boolean;
  price: number;
  high3m: number;
  /** Fraction below the 3-month high (0.12 = 12% off). */
  offPct: number;
  suggestedAmount: number;
  suggestedShares: number | null;
  /** Why the suggestion is smaller than the deploy fraction (or zero). */
  note: string | null;
  capUnverified: boolean;
}

export interface OutsidePosition {
  symbol: string;
  shares: number;
  value: number;
  pctOfTotal: number;
  reason: string;
}

export interface GuidelineResult {
  totalValue: number;
  cash: number;
  buckets: BucketStatus[];
  actions: GuidelineAction[];
  dipSignals: DipSignal[];
  outside: OutsidePosition[];
  positions: ClassifiedPosition[];
  /** No actions and no dip signals. */
  onTarget: boolean;
  /** Any bucket outside the band (before the plan). */
  outOfBand: boolean;
  /** Projected bucket values after every action is carried out. */
  projected: Record<BucketId, number>;
  warnings: string[];
}

export interface EngineInput {
  positions: Position[];
  cash: number;
  quotes: Record<string, QuoteLite | null | undefined>;
  config: GuidelineConfig;
}

/** Ignore suggestions smaller than this (dust). */
export const MIN_ACTION_USD = 50;

const EPS = 0.005;

export function bucketLabel(id: BucketId, config: Pick<GuidelineConfig, "sp500Symbol" | "nasdaqSymbol">): string {
  switch (id) {
    case "sp500":
      return `S&P 500 (${config.sp500Symbol})`;
    case "nasdaq":
      return `Nasdaq (${config.nasdaqSymbol})`;
    case "largeCap":
      return "Large-cap stocks";
    case "cash":
      return "Cash reserve";
  }
}

export function formatUsdCompact(n: number): string {
  if (n >= 1e12) return `$${round2(n / 1e12)}T`;
  if (n >= 1e9) return `$${Math.round(n / 1e9)}B`;
  if (n >= 1e6) return `$${Math.round(n / 1e6)}M`;
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

function classify(p: Position, q: QuoteLite | null | undefined, config: GuidelineConfig): {
  bucket: Exclude<Placement, "cash">;
  reason: string | null;
  capUnverified: boolean;
} {
  const sym = p.symbol;
  if (p.shares < 0) return { bucket: "outside", reason: "Short position — the rules are long-only", capUnverified: false };
  if (p.leverage > 1) return { bucket: "outside", reason: `Leveraged ×${p.leverage} — the rules are unleveraged`, capUnverified: false };
  if (sym === config.sp500Symbol) return { bucket: "sp500", reason: null, capUnverified: false };
  if (sym === config.nasdaqSymbol) return { bucket: "nasdaq", reason: null, capUnverified: false };
  if (q?.kind === "etf") {
    return {
      bucket: "outside",
      reason: `ETF other than ${config.sp500Symbol} / ${config.nasdaqSymbol}`,
      capUnverified: false,
    };
  }
  if (q?.marketCap != null) {
    if (q.marketCap >= config.largeCapMinUsd) return { bucket: "largeCap", reason: null, capUnverified: false };
    return {
      bucket: "outside",
      reason: `Market cap ${formatUsdCompact(q.marketCap)} is below the ${formatUsdCompact(config.largeCapMinUsd)} large-cap line`,
      capUnverified: false,
    };
  }
  // No market data: count it as a large cap for now (rather than suggesting
  // a sale on missing data) and say so.
  return { bucket: "largeCap", reason: null, capUnverified: true };
}

function approxShares(amount: number, price: number | null): number | null {
  if (price == null || !(price > 0)) return null;
  return Math.round((amount / price) * 100) / 100;
}

/** Split `amount` across items by weight (equal when all weights are 0). */
function splitByWeight<T>(items: T[], weight: (t: T) => number, amount: number): { item: T; amount: number }[] {
  if (items.length === 0) return [];
  const ws = items.map((i) => Math.max(0, weight(i)));
  const total = ws.reduce((a, b) => a + b, 0);
  return items.map((item, i) => ({ item, amount: total > 0 ? (amount * ws[i]) / total : amount / items.length }));
}

/**
 * Evaluate the account against the guidelines and build the plan.
 *
 * Plan (only when a bucket is out of band or something is outside the rules):
 *   1. Exit outside-the-rules positions (explicit sells → cash).
 *   2. Trim out-of-band over-target buckets to target (explicit sells → cash).
 *   3. Fund out-of-band under-target buckets from cash above the reserve
 *      target (the reserve itself is never spent on rebalancing).
 *   4. Still short? Trim over-target ETF buckets that are inside the band
 *      (never a large-cap stock to fund an ETF), then
 *   5. any cash still above target tops up the in-band under-target buckets.
 *   6. Whatever an out-of-band bucket still lacks → "put new money here".
 *   7. Cash below its band → hold sale proceeds / refill from gains or deposits.
 * Dip signals are evaluated every time and spend the cash left after the plan.
 */
export function evaluateGuidelines(input: EngineInput): GuidelineResult {
  const { config } = input;
  const warnings: string[] = [];
  const band = config.bandPct;

  const positions: ClassifiedPosition[] = input.positions.map((p) => {
    const q = input.quotes[p.symbol] ?? null;
    const c = classify(p, q, config);
    const price = q?.price != null && q.price > 0 ? q.price : null;
    const value = p.shares * (price ?? p.avgCost);
    return {
      symbol: p.symbol,
      shares: p.shares,
      avgCost: p.avgCost,
      price,
      priceSource: price != null ? "market" : "cost",
      value,
      pctOfTotal: 0,
      bucket: c.bucket,
      outsideReason: c.reason,
      capUnverified: c.capUnverified,
      marketCap: q?.marketCap ?? null,
    };
  });

  const noPrice = positions.filter((p) => p.priceSource === "cost").map((p) => p.symbol);
  if (noPrice.length) warnings.push(`No live price for ${noPrice.join(", ")} — valued at average cost.`);
  const unverified = positions.filter((p) => p.capUnverified).map((p) => p.symbol);
  if (unverified.length) {
    warnings.push(`Market cap unknown for ${unverified.join(", ")} — counted as large cap until it can be checked.`);
  }
  if (input.cash < 0) {
    warnings.push("Cash is negative — check the starting balance and deposits, or set a cash override.");
  }

  const totalValue = positions.reduce((s, p) => s + p.value, 0) + input.cash;
  const actual: Record<BucketId, number> = { sp500: 0, nasdaq: 0, largeCap: 0, cash: input.cash };
  for (const p of positions) if (p.bucket !== "outside") actual[p.bucket] += p.value;

  const pctOf = (v: number) => (totalValue > 0 ? (v / totalValue) * 100 : 0);
  for (const p of positions) p.pctOfTotal = pctOf(p.value);

  const target: Record<BucketId, number> = {
    sp500: (config.targets.sp500 / 100) * totalValue,
    nasdaq: (config.targets.nasdaq / 100) * totalValue,
    largeCap: (config.targets.largeCap / 100) * totalValue,
    cash: (config.targets.cash / 100) * totalValue,
  };

  const buckets: BucketStatus[] = BUCKET_IDS.map((id) => {
    const actualPct = pctOf(actual[id]);
    const driftPct = actualPct - config.targets[id];
    return {
      id,
      label: bucketLabel(id, config),
      targetPct: config.targets[id],
      actualPct,
      targetValue: target[id],
      actualValue: actual[id],
      driftPct,
      driftValue: actual[id] - target[id],
      status: driftPct > band + 1e-9 ? "over" : driftPct < -band - 1e-9 ? "under" : "ok",
      symbols:
        id === "cash" ? [] : positions.filter((p) => p.bucket === id).map((p) => p.symbol),
    };
  });
  const statusOf = (id: BucketId) => buckets.find((b) => b.id === id)!.status;

  const outside: OutsidePosition[] = positions
    .filter((p) => p.bucket === "outside")
    .map((p) => ({ symbol: p.symbol, shares: p.shares, value: p.value, pctOfTotal: p.pctOfTotal, reason: p.outsideReason ?? "Outside the rules" }));

  const actions: GuidelineAction[] = [];
  const val: Record<BucketId, number> = { ...actual };
  const outOfBand = buckets.some((b) => b.status !== "ok");
  let seq = 0;
  /** Records an action; returns the rounded amount, or 0 when it's dust. */
  const push = (a: Omit<GuidelineAction, "id">): number => {
    const amount = Math.round(a.amount);
    if (amount < MIN_ACTION_USD) return 0;
    // Same move twice (e.g. two funding passes into SPY) → one action.
    const same = actions.find((x) => x.kind === a.kind && x.symbol === a.symbol && x.bucket === a.bucket);
    if (same) {
      same.amount += amount;
      same.shares = approxShares(same.amount, same.price);
      return amount;
    }
    actions.push({ ...a, amount, id: `${a.kind}-${a.symbol ?? a.bucket}-${seq++}` });
    return amount;
  };

  if (totalValue <= 0) {
    warnings.push("The account has no value yet — nothing to compare against the guidelines.");
    return {
      totalValue,
      cash: input.cash,
      buckets,
      actions: [],
      dipSignals: [],
      outside,
      positions,
      onTarget: true,
      outOfBand: false,
      projected: val,
      warnings,
    };
  }

  const lcHoldings = () => positions.filter((p) => p.bucket === "largeCap" && p.shares > 0);
  const etfSymbol = (b: "sp500" | "nasdaq") => (b === "sp500" ? config.sp500Symbol : config.nasdaqSymbol);
  const priceOf = (sym: string) => {
    const q = input.quotes[sym];
    return q?.price != null && q.price > 0 ? q.price : null;
  };

  // Dip candidates are needed up front so large-cap rebalancing buys go to them first.
  const dipCandidates = findDipCandidates(positions, input, config);

  const sellBucket = (b: Exclude<BucketId, "cash">, amount: number, reason: string) => {
    if (amount < MIN_ACTION_USD) return;
    if (b === "largeCap") {
      for (const { item, amount: a } of splitByWeight(lcHoldings(), (p) => p.value, amount)) {
        const done = push({ kind: "trim", bucket: b, symbol: item.symbol, amount: a, shares: approxShares(a, item.price), price: item.price, reason });
        val.largeCap -= done;
        val.cash += done;
      }
    } else {
      const sym = etfSymbol(b);
      const done = push({ kind: "trim", bucket: b, symbol: sym, amount, shares: approxShares(amount, priceOf(sym)), price: priceOf(sym), reason });
      val[b] -= done;
      val.cash += done;
    }
  };

  const buyBucket = (b: Exclude<BucketId, "cash">, amount: number, reason: string) => {
    if (amount < MIN_ACTION_USD) return;
    if (b === "largeCap") {
      const dipping = dipCandidates.filter((d) => d.held).map((d) => d.symbol);
      const held = lcHoldings();
      const targets = dipping.length ? held.filter((p) => dipping.includes(p.symbol)) : held;
      if (targets.length === 0) {
        const done = push({ kind: "buy", bucket: b, symbol: null, amount, shares: null, price: null, reason: `${reason} Pick a stock worth ≥ ${formatUsdCompact(config.largeCapMinUsd)}.` });
        val.largeCap += done;
        val.cash -= done;
        return;
      }
      const why = dipping.length ? `${reason} Directed to the name(s) trading below their 3-month high.` : reason;
      for (const { item, amount: a } of splitByWeight(targets, () => 1, amount)) {
        const done = push({ kind: "buy", bucket: b, symbol: item.symbol, amount: a, shares: approxShares(a, item.price), price: item.price, reason: why });
        val.largeCap += done;
        val.cash -= done;
      }
    } else {
      const sym = etfSymbol(b);
      const done = push({ kind: "buy", bucket: b, symbol: sym, amount, shares: approxShares(amount, priceOf(sym)), price: priceOf(sym), reason });
      val[b] += done;
      val.cash -= done;
    }
  };

  const needsPlan = outOfBand || outside.length > 0;
  const initialCash = input.cash;

  if (needsPlan) {
    // 1. Exit positions outside the rules.
    for (const o of outside) {
      const amount = Math.abs(o.value);
      const pos = positions.find((p) => p.symbol === o.symbol && p.shares === o.shares)!;
      const done = push({ kind: "exit", bucket: "outside", symbol: o.symbol, amount, shares: Math.abs(o.shares), price: pos.price, reason: o.reason });
      val.cash += o.value < 0 ? -done : done; // covering a short spends cash
    }

    // 2. Trim out-of-band over-target buckets.
    for (const b of ["sp500", "nasdaq", "largeCap"] as const) {
      if (statusOf(b) === "over") {
        sellBucket(b, val[b] - target[b], `${bucketLabel(b, config)} is ${round1(pctOf(val[b]) - config.targets[b])} pts over its ${config.targets[b]}% target.`);
      }
    }

    const spendable = () => Math.max(0, val.cash - target.cash);
    const deficit = (b: BucketId) => Math.max(0, target[b] - val[b]);
    const oobUnder = (["sp500", "nasdaq", "largeCap"] as const).filter((b) => statusOf(b) === "under");
    const underReason = (b: Exclude<BucketId, "cash">) =>
      `${bucketLabel(b, config)} is ${round1(config.targets[b] - pctOf(actual[b]))} pts under its ${config.targets[b]}% target.`;

    const fund = (receivers: readonly Exclude<BucketId, "cash">[]) => {
      const needs = receivers.map((b) => ({ b, need: deficit(b) })).filter((x) => x.need > EPS);
      const totalNeed = needs.reduce((s, x) => s + x.need, 0);
      const avail = spendable();
      if (totalNeed <= EPS || avail <= EPS) return;
      const scale = Math.min(1, avail / totalNeed);
      for (const { b, need } of needs) buyBucket(b, need * scale, underReason(b));
    };

    // 3. Out-of-band under buckets from cash above the reserve target.
    fund(oobUnder);

    // 4. Still short → trim in-band over-target ETF buckets (never large caps for ETFs).
    const stillShort = oobUnder.filter((b) => deficit(b) >= MIN_ACTION_USD);
    if (stillShort.length) {
      for (const b of ["sp500", "nasdaq"] as const) {
        if (stillShort.includes(b) || val[b] <= target[b] + EPS) continue;
        const remainingNeed = stillShort.reduce((s, r) => s + deficit(r), 0) - spendable();
        if (remainingNeed < MIN_ACTION_USD) break;
        const trim = Math.min(val[b] - target[b], remainingNeed);
        sellBucket(b, trim, `Moves money from ${bucketLabel(b, config)} (over target) to the underweight bucket.`);
      }
      fund(stillShort);
    }

    // 5. Leftover cash above target → in-band under buckets.
    const inBandUnder = (["sp500", "nasdaq", "largeCap"] as const).filter(
      (b) => statusOf(b) === "ok" && val[b] < target[b] - EPS
    );
    fund(inBandUnder);

    // 6. Out-of-band buckets still short → new money.
    for (const b of oobUnder) {
      const need = deficit(b);
      push({
        kind: "deposit",
        bucket: b,
        symbol: b === "largeCap" ? null : etfSymbol(b),
        amount: need,
        shares: b === "largeCap" ? null : approxShares(need, priceOf(etfSymbol(b))),
        price: b === "largeCap" ? null : priceOf(etfSymbol(b)),
        reason: `Not enough free cash without touching the ${config.targets.cash}% reserve — put new deposits here.`,
      });
    }

    // 7. Cash reserve.
    const raised = val.cash - initialCash;
    if (initialCash < target.cash - EPS && raised > EPS) {
      push({
        kind: "hold-cash",
        bucket: "cash",
        symbol: null,
        amount: Math.min(raised, target.cash - initialCash),
        shares: null,
        price: null,
        reason: `Keep the sale proceeds as cash to rebuild the ${config.targets.cash}% dip reserve.`,
      });
    }
  }

  // Dip signals spend the cash left after the plan.
  const dipSignals: DipSignal[] = [];
  let cashForDips = Math.max(0, val.cash);
  const lcCap = ((config.targets.largeCap + band) / 100) * totalValue;
  let deployed = 0;
  for (const d of dipCandidates) {
    const room = Math.max(0, lcCap - val.largeCap);
    const want = cashForDips * config.deployFraction;
    let amount = Math.min(want, room);
    let note: string | null = null;
    if (room < want) {
      note =
        room < MIN_ACTION_USD
          ? `Large caps are already at the ${config.targets.largeCap + band}% ceiling (target + band).`
          : `Capped so large caps stay within ${config.targets.largeCap + band}% (target + band).`;
    }
    if (cashForDips < MIN_ACTION_USD) note = "No cash reserve left to deploy.";
    amount = Math.floor(amount);
    if (amount < MIN_ACTION_USD) amount = 0;
    if (amount > 0) {
      push({
        kind: "dip-buy",
        bucket: "largeCap",
        symbol: d.symbol,
        amount,
        shares: approxShares(amount, d.price),
        price: d.price,
        reason: `${round1(d.offPct * 100)}% below its 3-month high — deploy ${fractionLabel(config.deployFraction)} of the cash reserve.`,
      });
      cashForDips -= amount;
      val.cash -= amount;
      val.largeCap += amount;
      deployed += amount;
    }
    dipSignals.push({
      symbol: d.symbol,
      held: d.held,
      price: d.price,
      high3m: d.high3m,
      offPct: d.offPct,
      suggestedAmount: Math.round(amount),
      suggestedShares: amount > 0 ? approxShares(amount, d.price) : null,
      note,
      capUnverified: d.capUnverified,
    });
  }

  // Refill: after a dip deployment, or when cash is still under its band.
  const shortfall = target.cash - val.cash;
  if (shortfall >= MIN_ACTION_USD && (deployed > 0 || pctOf(val.cash) < config.targets.cash - band - 1e-9)) {
    push({
      kind: "refill",
      bucket: "cash",
      symbol: null,
      amount: shortfall,
      shares: null,
      price: null,
      reason: deployed > 0
        ? `After buying the dip, rebuild the reserve to ${config.targets.cash}% from gains or new deposits.`
        : `The reserve is below ${config.targets.cash - band}% — rebuild it to ${config.targets.cash}% from gains or new deposits.`,
    });
  }

  const ORDER: Record<ActionKind, number> = { exit: 0, trim: 1, buy: 2, "dip-buy": 3, deposit: 4, "hold-cash": 5, refill: 6 };
  actions.sort((a, b) => ORDER[a.kind] - ORDER[b.kind] || b.amount - a.amount);

  return {
    totalValue,
    cash: input.cash,
    buckets,
    actions,
    dipSignals,
    outside,
    positions,
    onTarget: actions.length === 0,
    outOfBand,
    projected: val,
    warnings,
  };
}

interface DipCandidate {
  symbol: string;
  held: boolean;
  price: number;
  high3m: number;
  offPct: number;
  capUnverified: boolean;
}

function findDipCandidates(positions: ClassifiedPosition[], input: EngineInput, config: GuidelineConfig): DipCandidate[] {
  const out: DipCandidate[] = [];
  const seen = new Set<string>();
  const consider = (symbol: string, held: boolean, capUnverified: boolean) => {
    if (seen.has(symbol)) return;
    seen.add(symbol);
    const q = input.quotes[symbol];
    if (!q || q.price == null || q.high3m == null || !(q.high3m > 0)) return;
    const offPct = 1 - q.price / q.high3m;
    if (offPct * 100 + 1e-9 < config.dipPct) return;
    out.push({ symbol, held, price: q.price, high3m: q.high3m, offPct, capUnverified });
  };
  for (const p of positions) if (p.bucket === "largeCap" && p.shares > 0) consider(p.symbol, true, p.capUnverified);
  for (const raw of config.watchlist) {
    const sym = raw.toUpperCase();
    if (sym === config.sp500Symbol || sym === config.nasdaqSymbol) continue;
    if (positions.some((p) => p.symbol === sym)) continue; // held but outside the rules → no dip buys
    const q = input.quotes[sym];
    if (!q || q.kind === "etf") continue;
    if (q.marketCap != null && q.marketCap < config.largeCapMinUsd) continue;
    consider(sym, false, q.marketCap == null);
  }
  return out.sort((a, b) => b.offPct - a.offPct);
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function fractionLabel(f: number): string {
  const common: [number, string][] = [
    [1 / 2, "1/2"],
    [1 / 3, "1/3"],
    [1 / 4, "1/4"],
    [2 / 3, "2/3"],
    [1, "all"],
  ];
  for (const [v, l] of common) if (Math.abs(f - v) < 0.005) return l;
  return `${Math.round(f * 100)}%`;
}

// ── Text ───────────────────────────────────────────────────────────

const usd0 = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

export function sharesLabel(shares: number | null): string {
  if (shares == null) return "";
  if (shares < 1) return "<1 share";
  const n = Math.round(shares);
  return `~${n.toLocaleString("en-US")} share${n === 1 ? "" : "s"}`;
}

/** "Buy $4,200 of SPY (~7 shares)". `money` formats a USD amount. */
export function describeAction(a: GuidelineAction, money: (usd: number) => string = usd0): string {
  const amt = money(a.amount);
  const sh = sharesLabel(a.shares);
  const tail = sh ? ` (${sh})` : "";
  switch (a.kind) {
    case "exit":
      return `Sell all ${a.symbol}${a.amount ? ` (${amt})` : ""} — outside the rules`;
    case "trim":
      return `Trim ${amt} of ${a.symbol}${tail}`;
    case "buy":
      return a.symbol ? `Buy ${amt} of ${a.symbol}${tail}` : `Buy ${amt} of a large-cap stock`;
    case "dip-buy":
      return `Buy the dip: ${amt} of ${a.symbol}${tail}`;
    case "deposit":
      return a.symbol ? `Put the next ${amt} of new money into ${a.symbol}${tail}` : `Put the next ${amt} of new money into large caps`;
    case "hold-cash":
      return `Hold ${amt} more in cash`;
    case "refill":
      return `Refill the cash reserve by ${amt}`;
  }
}

export interface GuidelineSummary {
  onTarget: boolean;
  actionCount: number;
  headline: string;
  totalValueUsd: number;
  buckets: { id: BucketId; label: string; actualPct: number; targetPct: number; status: BucketState }[];
  actions: string[];
  dipSignals: string[];
  outside: string[];
  warnings: string[];
}

/**
 * Compact, model-friendly status for the household advisor snapshot (USD).
 * Sent as `tradingGuidelines` in the advisor snapshot (guidelines-data.ts `getGuidelineSummary`).
 */
export function summarizeGuidelines(r: GuidelineResult): GuidelineSummary {
  const off = r.buckets.filter((b) => b.status !== "ok");
  const headline = r.onTarget
    ? "Stocks account is on target with its guidelines."
    : `Stocks account: ${r.actions.length} action${r.actions.length === 1 ? "" : "s"} to match the guidelines` +
      (off.length ? ` (${off.map((b) => `${b.label} ${b.status} by ${round1(Math.abs(b.driftPct))} pts`).join("; ")})` : "") +
      ".";
  return {
    onTarget: r.onTarget,
    actionCount: r.actions.length,
    headline,
    totalValueUsd: Math.round(r.totalValue),
    buckets: r.buckets.map((b) => ({ id: b.id, label: b.label, actualPct: round1(b.actualPct), targetPct: b.targetPct, status: b.status })),
    actions: r.actions.map((a) => describeAction(a)),
    dipSignals: r.dipSignals.map(
      (d) => `${d.symbol} ${round1(d.offPct * 100)}% below its 3-month high (${usd0(d.price)} vs ${usd0(d.high3m)}); suggested ${usd0(d.suggestedAmount)}`
    ),
    outside: r.outside.map((o) => `${o.symbol} (${usd0(o.value)}): ${o.reason}`),
    warnings: r.warnings,
  };
}
