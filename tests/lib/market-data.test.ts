import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  isUsMarketHours,
  normalizeSymbol,
  parseMoney,
  parseNasdaqHistorical,
  parseNasdaqInfo,
  parseNasdaqSummary,
  parseYahooChart,
  quoteTtlSeconds,
} from "../../src/lib/market-data";

const fx = (name: string): unknown =>
  JSON.parse(readFileSync(join(__dirname, "../fixtures/market", name), "utf8"));

describe("parseMoney", () => {
  it("handles dollars, commas and bare numbers", () => {
    expect(parseMoney("$1,234.56")).toBe(1234.56);
    expect(parseMoney("608.45")).toBe(608.45);
    expect(parseMoney("3,093,823,040,000")).toBe(3_093_823_040_000);
    expect(parseMoney(12)).toBe(12);
  });
  it("returns null for placeholders", () => {
    expect(parseMoney("N/A")).toBeNull();
    expect(parseMoney("")).toBeNull();
    expect(parseMoney(null)).toBeNull();
    expect(parseMoney("$145.98/$145.71")).toBeNull();
  });
});

describe("parseYahooChart", () => {
  it("reads price, 3-month high, kind and name", () => {
    const r = parseYahooChart(fx("yahoo-chart-msft.json"))!;
    expect(r.price).toBe(402.5);
    expect(r.high3m).toBe(448.9);
    expect(r.kind).toBe("stock");
    expect(r.name).toBe("Microsoft Corporation");
    expect(r.priceAsOf).toBe(new Date(1795208400 * 1000).toISOString());
  });
  it("skips null bars and falls back to the last close", () => {
    const r = parseYahooChart(fx("yahoo-chart-etf-nulls.json"))!;
    expect(r.kind).toBe("etf");
    expect(r.price).toBe(608.45);
    expect(r.high3m).toBe(676.49);
  });
  it("returns null for an error payload or garbage", () => {
    expect(parseYahooChart(fx("yahoo-chart-notfound.json"))).toBeNull();
    expect(parseYahooChart("Too Many Requests")).toBeNull();
    expect(parseYahooChart(null)).toBeNull();
  });
});

describe("Nasdaq parsers", () => {
  it("info: price, kind, name", () => {
    const nvda = parseNasdaqInfo(fx("nasdaq-info-nvda.json"))!;
    expect(nvda.kind).toBe("stock");
    expect(nvda.price).toBeCloseTo(128.3744);
    expect(nvda.name).toMatch(/NVIDIA/);
    expect(nvda.priceAsOf).not.toBeNull();
    const qqq = parseNasdaqInfo(fx("nasdaq-info-qqq.json"))!;
    expect(qqq.kind).toBe("etf");
    expect(qqq.price).toBe(608.45);
  });
  it("historical: max daily high and newest close", () => {
    const h = parseNasdaqHistorical(fx("nasdaq-historical-nvda.json"))!;
    expect(h.high3m).toBe(243.37);
    expect(h.lastClose).toBe(125.53);
    expect(h.lastDate).not.toBeNull();
  });
  it("summary: market cap for stocks, ETF class for funds", () => {
    expect(parseNasdaqSummary(fx("nasdaq-summary-nvda.json"))).toEqual({
      marketCap: 3_093_823_040_000,
      kind: "stock",
    });
    expect(parseNasdaqSummary(fx("nasdaq-summary-spy.json"))?.kind).toBe("etf");
  });
  it("returns null on rCode 400 ('Symbol not exists')", () => {
    expect(parseNasdaqSummary(fx("nasdaq-summary-notfound.json"))).toBeNull();
    expect(parseNasdaqInfo(fx("nasdaq-summary-notfound.json"))).toBeNull();
    expect(parseNasdaqHistorical(fx("nasdaq-summary-notfound.json"))).toBeNull();
  });
});

describe("market hours / TTL", () => {
  it("is open on a weekday mid-session (New York time)", () => {
    // Fri 2026-11-20 15:00 UTC = 10:00 EST
    expect(isUsMarketHours(new Date("2026-11-20T15:00:00Z"))).toBe(true);
    expect(quoteTtlSeconds(new Date("2026-11-20T15:00:00Z"))).toBe(900);
  });
  it("is closed before the open, after the close and at weekends", () => {
    expect(isUsMarketHours(new Date("2026-11-20T14:00:00Z"))).toBe(false); // 09:00 EST
    expect(isUsMarketHours(new Date("2026-11-20T21:30:00Z"))).toBe(false); // 16:30 EST
    expect(isUsMarketHours(new Date("2026-11-21T16:00:00Z"))).toBe(false); // Saturday
    expect(quoteTtlSeconds(new Date("2026-11-21T16:00:00Z"))).toBe(3600);
  });
});

describe("normalizeSymbol", () => {
  it("uppercases and validates", () => {
    expect(normalizeSymbol(" aapl ")).toBe("AAPL");
    expect(normalizeSymbol("brk.b")).toBe("BRK.B");
    expect(normalizeSymbol("")).toBeNull();
    expect(normalizeSymbol("not a ticker")).toBeNull();
  });
});
