import { describe, expect, it } from "vitest";
import {
  DEFAULT_GUIDELINE_CONFIG,
  MIN_ACTION_USD,
  deriveCash,
  derivePositions,
  describeAction,
  evaluateGuidelines,
  guidelineConfigSchema,
  parseGuidelineConfig,
  resolveCash,
  sharesLabel,
  sumRealizedPnL,
  summarizeGuidelines,
  type GuidelineConfig,
  type GuidelineResult,
  type Position,
  type QuoteLite,
  type TradeForHoldings,
} from "../../src/lib/guidelines";

// Synthetic, round-number fixtures only (the repo is public).
const B = 1e9;
const etf = (price: number, high3m = price): QuoteLite => ({ price, high3m, marketCap: null, kind: "etf" });
const stock = (price: number, marketCap: number | null = 2000 * B, high3m = price): QuoteLite => ({
  price,
  high3m,
  marketCap,
  kind: "stock",
});

/** A position worth `value` at `price` (shares = value / price, cost = price). */
const pos = (symbol: string, value: number, price: number, extra: Partial<Position> = {}): Position => ({
  symbol,
  shares: value / price,
  avgCost: price,
  costBasis: value,
  leverage: 1,
  tradeCount: 1,
  ...extra,
});

const cfg = (over: Partial<GuidelineConfig> = {}): GuidelineConfig => ({ ...DEFAULT_GUIDELINE_CONFIG, ...over });

function run(positions: Position[], cash: number, quotes: Record<string, QuoteLite>, config = cfg()): GuidelineResult {
  return evaluateGuidelines({ positions, cash, quotes, config });
}

const kinds = (r: GuidelineResult) => r.actions.map((a) => `${a.kind}:${a.symbol ?? a.bucket}:${a.amount}`);
const bucket = (r: GuidelineResult, id: string) => r.buckets.find((b) => b.id === id)!;

/** Buys never spend more than the starting cash plus explicit sale proceeds. */
function assertFunded(r: GuidelineResult, initialCash: number) {
  const sells = r.actions.filter((a) => a.kind === "trim" || a.kind === "exit").reduce((s, a) => s + a.amount, 0);
  const buys = r.actions.filter((a) => a.kind === "buy" || a.kind === "dip-buy").reduce((s, a) => s + a.amount, 0);
  expect(buys).toBeLessThanOrEqual(Math.max(0, initialCash) + sells + 1);
  if (initialCash >= 0) expect(r.projected.cash).toBeGreaterThanOrEqual(-1);
}

describe("config", () => {
  it("seeds the agreed defaults ($100B large-cap line)", () => {
    expect(DEFAULT_GUIDELINE_CONFIG.targets).toEqual({ sp500: 30, nasdaq: 20, largeCap: 25, cash: 25 });
    expect(DEFAULT_GUIDELINE_CONFIG.largeCapMinUsd).toBe(100 * B);
    expect(DEFAULT_GUIDELINE_CONFIG.bandPct).toBe(5);
    expect(DEFAULT_GUIDELINE_CONFIG.dipPct).toBe(10);
    expect(DEFAULT_GUIDELINE_CONFIG.deployFraction).toBeCloseTo(1 / 3);
    expect(DEFAULT_GUIDELINE_CONFIG.sp500Symbol).toBe("SPY");
    expect(DEFAULT_GUIDELINE_CONFIG.nasdaqSymbol).toBe("QQQ");
    expect(guidelineConfigSchema.safeParse(DEFAULT_GUIDELINE_CONFIG).success).toBe(true);
  });

  it("rejects targets that don't sum to 100", () => {
    const bad = { ...DEFAULT_GUIDELINE_CONFIG, targets: { sp500: 30, nasdaq: 20, largeCap: 25, cash: 30 } };
    const r = guidelineConfigSchema.safeParse(bad);
    expect(r.success).toBe(false);
    expect(JSON.stringify(r.error?.issues)).toMatch(/sum to 100/);
  });

  it("normalises tickers and dedupes the watchlist", () => {
    const r = guidelineConfigSchema.parse({ ...DEFAULT_GUIDELINE_CONFIG, watchlist: ["msft", "MSFT", " googl "] });
    expect(r.watchlist).toEqual(["MSFT", "GOOGL"]);
    expect(guidelineConfigSchema.safeParse({ ...DEFAULT_GUIDELINE_CONFIG, watchlist: ["not a ticker"] }).success).toBe(false);
  });

  it("validates the cash override date", () => {
    expect(guidelineConfigSchema.safeParse({ ...DEFAULT_GUIDELINE_CONFIG, cashOverride: { amount: 1000, asOf: "2026-11-01" } }).success).toBe(true);
    expect(guidelineConfigSchema.safeParse({ ...DEFAULT_GUIDELINE_CONFIG, cashOverride: { amount: 1000, asOf: "Nov 1" } }).success).toBe(false);
  });

  it("parseGuidelineConfig merges partial / old configs with defaults and survives junk", () => {
    expect(parseGuidelineConfig(null)).toEqual(DEFAULT_GUIDELINE_CONFIG);
    expect(parseGuidelineConfig({ bandPct: 3 }).bandPct).toBe(3);
    expect(parseGuidelineConfig({ bandPct: 3 }).targets.cash).toBe(25);
    expect(parseGuidelineConfig({ targets: { cash: 99 } })).toEqual(DEFAULT_GUIDELINE_CONFIG); // invalid sum → defaults
  });
});

describe("derivePositions / cash", () => {
  const leg = (legType: "BUY" | "SELL", price: number, quantity: number) => ({ legType, price, quantity });
  const trade = (t: Partial<TradeForHoldings>): TradeForHoldings => ({
    symbol: "AAA",
    direction: "LONG",
    isCompleted: false,
    totalPnL: null,
    totalShares: null,
    sharesInProcess: null,
    entries: [],
    ...t,
  });

  it("nets open shares per symbol at weighted average cost and ignores completed trades", () => {
    const trades = [
      trade({ symbol: "aaa", entries: [leg("BUY", 100, 10)] }),
      trade({ symbol: "AAA", entries: [leg("BUY", 110, 20), leg("SELL", 120, 10)] }), // 10 open @110
      trade({ symbol: "BBB", isCompleted: true, entries: [leg("BUY", 50, 5), leg("SELL", 60, 5)] }),
    ];
    const ps = derivePositions(trades);
    expect(ps).toHaveLength(1);
    expect(ps[0].symbol).toBe("AAA");
    expect(ps[0].shares).toBe(20);
    expect(ps[0].avgCost).toBe(105);
    expect(ps[0].costBasis).toBe(2100);
    expect(ps[0].tradeCount).toBe(2);
  });

  it("reports shorts as negative shares at the average sell price and applies leverage", () => {
    const ps = derivePositions(
      [trade({ symbol: "CCC", direction: "SHORT", entries: [leg("SELL", 40, 10), leg("BUY", 35, 4)] })],
      { CCC: 2 }
    );
    expect(ps[0]).toMatchObject({ symbol: "CCC", shares: -6, avgCost: 40, costBasis: 240, leverage: 2 });
  });

  it("drops fully closed but not-yet-flagged trades", () => {
    expect(derivePositions([trade({ entries: [leg("BUY", 10, 5), leg("SELL", 12, 5)] })])).toEqual([]);
  });

  it("counts realized P&L like the dashboard (completed + partially closed)", () => {
    const trades = [
      trade({ isCompleted: true, totalPnL: 500 }),
      trade({ totalPnL: 100, totalShares: 10, sharesInProcess: 5 }), // partial
      trade({ totalPnL: 999, totalShares: 10, sharesInProcess: 10 }), // nothing closed yet
    ];
    expect(sumRealizedPnL(trades)).toBe(600);
  });

  it("cash = start + realized + deposits − open long cost + open short proceeds", () => {
    const c = deriveCash({
      startingBalance: 100_000,
      realizedPnL: 5_000,
      netDeposits: 10_000,
      positions: [pos("AAA", 30_000, 100), pos("CCC", 2_000, 20, { shares: -100 })],
    });
    expect(c.openLongCost).toBe(30_000);
    expect(c.openShortProceeds).toBe(2_000);
    expect(c.cash).toBe(87_000);
  });

  it("the override wins when set", () => {
    const derived = deriveCash({ startingBalance: 1000, realizedPnL: 0, netDeposits: 0, positions: [] });
    expect(resolveCash(derived, null)).toMatchObject({ amount: 1000, source: "derived" });
    expect(resolveCash(derived, { amount: 750, asOf: "2026-11-01" })).toMatchObject({ amount: 750, source: "override", asOf: "2026-11-01" });
  });
});

describe("evaluateGuidelines — buckets", () => {
  const quotes = { SPY: etf(500), QQQ: etf(400), AAPL: stock(200) };

  it("is on target when every bucket matches", () => {
    const r = run([pos("SPY", 30_000, 500), pos("QQQ", 20_000, 400), pos("AAPL", 25_000, 200)], 25_000, quotes);
    expect(r.totalValue).toBe(100_000);
    expect(r.buckets.map((b) => [b.id, Math.round(b.actualPct), b.status])).toEqual([
      ["sp500", 30, "ok"],
      ["nasdaq", 20, "ok"],
      ["largeCap", 25, "ok"],
      ["cash", 25, "ok"],
    ]);
    expect(r.actions).toEqual([]);
    expect(r.onTarget).toBe(true);
    expect(summarizeGuidelines(r).headline).toMatch(/on target/);
  });

  it("drift inside the band produces no trades (exactly 5 pts is still ok)", () => {
    const r = run([pos("SPY", 25_000, 500), pos("QQQ", 25_000, 400), pos("AAPL", 25_000, 200)], 25_000, quotes);
    expect(bucket(r, "sp500").status).toBe("ok");
    expect(bucket(r, "nasdaq").driftPct).toBeCloseTo(5);
    expect(r.actions).toEqual([]);
  });

  it("values positions at market and uses cost when the price is missing", () => {
    const r = run([pos("SPY", 30_000, 500), pos("XYZ", 10_000, 100)], 60_000, { SPY: etf(550) });
    expect(r.positions.find((p) => p.symbol === "SPY")!.value).toBe(33_000);
    const xyz = r.positions.find((p) => p.symbol === "XYZ")!;
    expect(xyz.priceSource).toBe("cost");
    expect(xyz.capUnverified).toBe(true);
    expect(xyz.bucket).toBe("largeCap");
    expect(r.warnings.join(" ")).toMatch(/No live price for XYZ/);
    expect(r.warnings.join(" ")).toMatch(/Market cap unknown for XYZ/);
  });
});

describe("evaluateGuidelines — outside the rules", () => {
  it("flags other ETFs, sub-$100B stocks, shorts and leverage", () => {
    const r = run(
      [
        pos("SPY", 30_000, 500),
        pos("ARKK", 5_000, 50),
        pos("MIDC", 5_000, 50), // $50B: was large cap under the old $10B line, outside now
        pos("SHRT", 2_000, 20, { shares: -100 }),
        pos("LEV", 3_000, 30, { leverage: 3 }),
      ],
      55_000,
      { SPY: etf(500), ARKK: etf(50), MIDC: stock(50, 50 * B), SHRT: stock(20), LEV: stock(30) }
    );
    const out = Object.fromEntries(r.outside.map((o) => [o.symbol, o.reason]));
    expect(Object.keys(out).sort()).toEqual(["ARKK", "LEV", "MIDC", "SHRT"]);
    expect(out.ARKK).toMatch(/ETF other than SPY \/ QQQ/);
    expect(out.MIDC).toMatch(/\$50B is below the \$100B/);
    expect(out.SHRT).toMatch(/Short/);
    expect(out.LEV).toMatch(/Leveraged/);
    const exits = r.actions.filter((a) => a.kind === "exit").map((a) => a.symbol);
    expect(exits.sort()).toEqual(["ARKK", "LEV", "MIDC", "SHRT"]);
    expect(r.actions[0].kind).toBe("exit");
  });

  it("a $100B+ stock is a large cap; $99B is not", () => {
    const r = run(
      [pos("BIG", 10_000, 10), pos("NEAR", 10_000, 10)],
      80_000,
      { BIG: stock(10, 100 * B), NEAR: stock(10, 99 * B) }
    );
    expect(r.positions.find((p) => p.symbol === "BIG")!.bucket).toBe("largeCap");
    expect(r.positions.find((p) => p.symbol === "NEAR")!.bucket).toBe("outside");
  });

  it("respects a custom large-cap threshold", () => {
    const r = run([pos("MIDC", 10_000, 10)], 90_000, { MIDC: stock(10, 50 * B) }, cfg({ largeCapMinUsd: 10 * B }));
    expect(r.positions[0].bucket).toBe("largeCap");
  });

  it("exit proceeds fund underweight buckets", () => {
    // SPY 10%, QQQ 20%, LC 25%, ARKK 20%, cash 25% → sell ARKK, buy SPY 20k.
    const r = run(
      [pos("SPY", 10_000, 500), pos("QQQ", 20_000, 400), pos("AAPL", 25_000, 200), pos("ARKK", 20_000, 50)],
      25_000,
      { SPY: etf(500), QQQ: etf(400), AAPL: stock(200), ARKK: etf(50) }
    );
    expect(kinds(r)).toEqual(["exit:ARKK:20000", "buy:SPY:20000"]);
    expect(r.actions[1].shares).toBe(40);
    assertFunded(r, 25_000);
  });
});

describe("evaluateGuidelines — rebalancing", () => {
  const quotes = { SPY: etf(500), QQQ: etf(400), AAPL: stock(200), MSFT: stock(400), NVDA: stock(100, 3000 * B, 125) };

  it("sample account: SPY 18%, QQQ 25%, large caps 30%, cash 27%, NVDA 12% off its high", () => {
    const q = { ...quotes, NVDA: stock(88, 3000 * B, 100) };
    const r = run(
      [pos("SPY", 36_000, 500), pos("QQQ", 50_000, 400), pos("AAPL", 20_000, 200), pos("MSFT", 20_000, 400), pos("NVDA", 20_000, 88)],
      54_000,
      q
    );
    expect(bucket(r, "sp500").status).toBe("under");
    // Cash above the 25% reserve (4k) first, then QQQ's excess (10k) — never AAPL/MSFT/NVDA — then new money.
    expect(kinds(r)).toEqual(["trim:QQQ:10000", "buy:SPY:14000", "deposit:SPY:10000"]);
    expect(describeAction(r.actions[1])).toBe("Buy $14,000 of SPY (~28 shares)");
    expect(describeAction(r.actions[0])).toBe("Trim $10,000 of QQQ (~25 shares)");
    // NVDA is a dip signal, but large caps already sit at the 30% ceiling.
    expect(r.dipSignals).toHaveLength(1);
    expect(r.dipSignals[0]).toMatchObject({ symbol: "NVDA", held: true, suggestedAmount: 0 });
    expect(r.dipSignals[0].offPct).toBeCloseTo(0.12);
    expect(r.dipSignals[0].note).toMatch(/ceiling/);
    expect(r.projected.cash).toBeCloseTo(50_000);
    assertFunded(r, 54_000);
  });

  it("never sells large caps to fund an ETF; asks for new money instead", () => {
    // SPY 20% (under), QQQ 20%, LC 30% (over, in band), cash 30% (over, in band).
    const r = run(
      [pos("SPY", 20_000, 500), pos("QQQ", 20_000, 400), pos("AAPL", 30_000, 200)],
      30_000,
      quotes
    );
    expect(r.actions.some((a) => a.kind === "trim" && a.bucket === "largeCap")).toBe(false);
    expect(kinds(r)).toEqual(["buy:SPY:5000", "deposit:SPY:5000"]);
    assertFunded(r, 30_000);
  });

  it("deploys excess cash into an underweight large-cap bucket, split across holdings", () => {
    // LC 10% (under 15), cash 40% (over 15).
    const r = run(
      [pos("SPY", 30_000, 500), pos("QQQ", 20_000, 400), pos("AAPL", 5_000, 200), pos("MSFT", 5_000, 400)],
      40_000,
      quotes
    );
    expect(kinds(r)).toEqual(["buy:AAPL:7500", "buy:MSFT:7500"]);
    expect(r.projected.cash).toBe(25_000);
    expect(r.onTarget).toBe(false);
    assertFunded(r, 40_000);
  });

  it("suggests a generic large-cap buy when none are held", () => {
    const r = run([pos("SPY", 30_000, 500), pos("QQQ", 20_000, 400)], 50_000, quotes);
    const buy = r.actions.find((a) => a.kind === "buy")!;
    expect(buy).toMatchObject({ symbol: null, bucket: "largeCap", amount: 25_000 });
    expect(describeAction(buy)).toBe("Buy $25,000 of a large-cap stock");
    expect(buy.reason).toMatch(/\$100B/);
  });

  it("trims an out-of-band large-cap bucket pro rata and holds the cash when the reserve is low", () => {
    // LC 45% (AAPL 30k + MSFT 15k), cash 5% → trim 20k (AAPL 2/3, MSFT 1/3), keep as cash.
    const r = run(
      [pos("SPY", 30_000, 500), pos("QQQ", 20_000, 400), pos("AAPL", 30_000, 200), pos("MSFT", 15_000, 400)],
      5_000,
      quotes
    );
    expect(kinds(r)).toEqual(["trim:AAPL:13333", "trim:MSFT:6667", "hold-cash:cash:20000"]);
    expect(describeAction(r.actions[2])).toBe("Hold $20,000 more in cash");
    expect(r.projected.cash).toBe(25_000);
  });

  it("asks to refill the reserve when cash is under its band and nothing is over", () => {
    const r = run([pos("SPY", 35_000, 500), pos("QQQ", 25_000, 400), pos("AAPL", 30_000, 200)], 10_000, quotes);
    // SPY/QQQ/LC are all in band (+5 each), cash is -15 → refill 15k from gains/deposits.
    expect(kinds(r)).toEqual(["refill:cash:15000"]);
    expect(r.actions[0].reason).toMatch(/gains or new deposits/);
  });

  it("never spends money it doesn't have when cash is negative", () => {
    const flat = run([pos("SPY", 35_000, 500), pos("QQQ", 25_000, 400), pos("AAPL", 50_000, 200)], -10_000, quotes);
    // LC is over → trimmed; nothing is bought because there is no free cash.
    expect(flat.actions.filter((a) => a.kind === "buy" || a.kind === "dip-buy")).toEqual([]);
    expect(flat.actions.some((a) => a.kind === "refill")).toBe(true);
    // Any buy must be paid for by an explicit sale.
    const r = run([pos("SPY", 50_000, 500), pos("AAPL", 60_000, 200)], -10_000, quotes);
    expect(r.warnings.join(" ")).toMatch(/Cash is negative/);
    assertFunded(r, -10_000);
  });

  it("orders sells before buys and dust is ignored", () => {
    const r = run(
      [pos("SPY", 20_000, 500), pos("QQQ", 31_000, 400), pos("AAPL", 25_000, 200), pos("ARKK", 4_000, 50)],
      20_000,
      { ...quotes, ARKK: etf(50) }
    );
    const order = r.actions.map((a) => a.kind);
    const firstBuy = order.findIndex((k) => k === "buy" || k === "deposit");
    const lastSell = Math.max(order.lastIndexOf("trim"), order.lastIndexOf("exit"));
    expect(lastSell).toBeLessThan(firstBuy);
    expect(r.actions.every((a) => a.amount >= MIN_ACTION_USD)).toBe(true);
    assertFunded(r, 20_000);
  });
});

describe("evaluateGuidelines — dip rule", () => {
  it("deploys a third of the cash reserve into a dipping large cap, then asks to refill", () => {
    // All in band: SPY 30, QQQ 20, LC 20 (AAPL 10 + NVDA 10), cash 30. NVDA 15% off.
    const r = run(
      [pos("SPY", 30_000, 500), pos("QQQ", 20_000, 400), pos("AAPL", 10_000, 200), pos("NVDA", 10_000, 85)],
      30_000,
      { SPY: etf(500), QQQ: etf(400), AAPL: stock(200, 3000 * B, 205), NVDA: stock(85, 3000 * B, 100) }
    );
    expect(r.outOfBand).toBe(false);
    expect(r.dipSignals).toHaveLength(1);
    expect(r.dipSignals[0]).toMatchObject({ symbol: "NVDA", suggestedAmount: 10_000, note: null });
    expect(kinds(r)).toEqual(["dip-buy:NVDA:10000", "refill:cash:5000"]);
    expect(describeAction(r.actions[0])).toBe("Buy the dip: $10,000 of NVDA (~118 shares)");
    assertFunded(r, 30_000);
  });

  it("caps dip buys at target + band and takes deeper dips first", () => {
    // LC 25%, cash 25%, room to the 30% ceiling = 5k; two dips.
    const r = run(
      [pos("SPY", 30_000, 500), pos("QQQ", 20_000, 400), pos("AAPL", 12_500, 80), pos("MSFT", 12_500, 300)],
      25_000,
      { SPY: etf(500), QQQ: etf(400), AAPL: stock(80, 3000 * B, 100), MSFT: stock(300, 3000 * B, 360) }
    );
    expect(r.dipSignals.map((d) => d.symbol)).toEqual(["AAPL", "MSFT"]); // 20% off before 16.7% off
    expect(r.dipSignals[0]).toMatchObject({ suggestedAmount: 5_000 });
    expect(r.dipSignals[0].note).toMatch(/Capped/);
    expect(r.dipSignals[1]).toMatchObject({ suggestedAmount: 0 });
    expect(r.projected.largeCap).toBe(30_000);
  });

  it("each signal takes a fraction of what's left", () => {
    const r = run(
      [pos("SPY", 30_000, 500), pos("QQQ", 20_000, 400), pos("AAPL", 1_000, 80), pos("MSFT", 1_000, 300)],
      48_000,
      { SPY: etf(500), QQQ: etf(400), AAPL: stock(80, 3000 * B, 100), MSFT: stock(300, 3000 * B, 360) },
      cfg({ targets: { sp500: 30, nasdaq: 20, largeCap: 2, cash: 48 }, bandPct: 50 })
    );
    expect(r.dipSignals.map((d) => d.suggestedAmount)).toEqual([16_000, 10_666]);
  });

  it("only fires at the configured dip % and includes watchlist names", () => {
    const quotes = {
      SPY: etf(500),
      QQQ: etf(400),
      AAPL: stock(91, 3000 * B, 100), // 9% off — no signal
      GOOGL: stock(80, 2000 * B, 100), // watchlist, 20% off
      SMOL: stock(80, 5 * B, 100), // watchlist but below $100B → ignored
      ARKK: etf(50, 100), // ETFs never
    };
    const r = run(
      [pos("SPY", 30_000, 500), pos("QQQ", 20_000, 400), pos("AAPL", 20_000, 91)],
      30_000,
      quotes,
      cfg({ watchlist: ["GOOGL", "SMOL", "ARKK"] })
    );
    expect(r.dipSignals.map((d) => [d.symbol, d.held])).toEqual([["GOOGL", false]]);
    expect(r.dipSignals[0].suggestedAmount).toBe(10_000);
    const lower = run([pos("AAPL", 20_000, 91)], 80_000, quotes, cfg({ dipPct: 5, bandPct: 50 }));
    expect(lower.dipSignals.map((d) => d.symbol)).toEqual(["AAPL"]);
  });
});

describe("text helpers", () => {
  it("formats share counts", () => {
    expect(sharesLabel(7.2)).toBe("~7 shares");
    expect(sharesLabel(1)).toBe("~1 share");
    expect(sharesLabel(0.4)).toBe("<1 share");
    expect(sharesLabel(null)).toBe("");
  });

  it("summarizes for the advisor", () => {
    const r = run([pos("SPY", 10_000, 500)], 90_000, { SPY: etf(500) });
    const s = summarizeGuidelines(r);
    expect(s.onTarget).toBe(false);
    expect(s.actionCount).toBe(r.actions.length);
    expect(s.headline).toMatch(/action/);
    expect(s.actions[0]).toMatch(/^Buy \$/);
  });

  it("handles an empty account", () => {
    const r = run([], 0, {});
    expect(r.onTarget).toBe(true);
    expect(r.warnings.join(" ")).toMatch(/no value/);
  });
});
