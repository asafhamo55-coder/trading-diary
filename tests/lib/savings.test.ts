import { describe, expect, it } from "vitest";
import {
  DEFAULT_RETIREMENT_AGE,
  DEFAULT_USD_ILS_RATE,
  ageAt,
  annualFeeCost,
  buildNetWorth,
  childMilestones,
  convert,
  findCoverageOverlaps,
  hishtalmutLiquidity,
  parseLooseDate,
  policyLast4,
  projectFeeDrag,
  projectRetirement,
  resolveUsdIlsRate,
  retirementTiming,
  savingsHistory,
  type BenefitLite,
  type FxRate,
  type HouseholdMember,
  type SavingsAccountLite,
} from "../../src/lib/savings";

const fx: FxRate = { usdIls: 4, source: "profile" };
const asOf = new Date(Date.UTC(2026, 10, 21)); // 2026-11-21

function acct(over: Partial<SavingsAccountLite>): SavingsAccountLite {
  return {
    id: "a1",
    owner: "adult_a",
    country: "IL",
    type: "pension",
    provider: "P",
    currency: "ILS",
    balance: 0,
    balanceAsOf: "2026-10-31",
    ...over,
  };
}

describe("dates", () => {
  it("parses statement date formats", () => {
    expect(parseLooseDate("2026-02")?.toISOString().slice(0, 10)).toBe("2026-02-28");
    expect(parseLooseDate("2026-03-15")?.toISOString().slice(0, 10)).toBe("2026-03-15");
    expect(parseLooseDate("15/03/2026")?.toISOString().slice(0, 10)).toBe("2026-03-15");
    expect(parseLooseDate("15.03.2026")?.toISOString().slice(0, 10)).toBe("2026-03-15");
    expect(parseLooseDate("31/02/2026")).toBeNull();
    expect(parseLooseDate("nope")).toBeNull();
    expect(parseLooseDate(null)).toBeNull();
  });

  it("computes age, respecting birthdays not yet reached", () => {
    expect(ageAt("1980-11-21", asOf)).toBe(46);
    expect(ageAt("1980-11-22", asOf)).toBe(45);
    expect(ageAt(null, asOf)).toBeNull();
  });
});

describe("FX", () => {
  it("prefers profile override, then env, then the default constant", () => {
    expect(resolveUsdIlsRate({ profileOverride: 3.5, envValue: "3.9" })).toEqual({ usdIls: 3.5, source: "profile" });
    expect(resolveUsdIlsRate({ profileOverride: null, envValue: "3.9" })).toEqual({ usdIls: 3.9, source: "env" });
    expect(resolveUsdIlsRate({ envValue: "abc" })).toEqual({ usdIls: DEFAULT_USD_ILS_RATE, source: "default" });
  });

  it("converts both ways", () => {
    expect(convert(400, "ILS", "USD", fx)).toBe(100);
    expect(convert(100, "USD", "ILS", fx)).toBe(400);
    expect(convert(7, "USD", "USD", fx)).toBe(7);
  });
});

describe("fees", () => {
  it("computes annual deposit + accumulation fees", () => {
    expect(annualFeeCost({ balance: 100000, monthlyDeposit: 1000, feeDepositPct: 2, feeAccumulationPct: 0.5 })).toEqual({
      deposit: 240,
      accumulation: 500,
      total: 740,
    });
  });

  it("projects fee drag vs benchmark", () => {
    const r = projectFeeDrag({
      balance: 100000,
      monthlyDeposit: 1000,
      feeDepositPct: 3,
      feeAccumulationPct: 1,
      years: 10,
      grossReturnPct: 5,
      benchmark: { depositPct: 1, accumulationPct: 0.2 },
    });
    expect(r.costVsBenchmark).toBeGreaterThan(0);
    expect(r.endBalanceBenchmark).toBeGreaterThan(r.endBalanceActual);
    expect(r.totalFeesActual).toBeGreaterThan(r.totalFeesBenchmark);
  });

  it("zero fees and zero return keep principal + deposits", () => {
    const r = projectFeeDrag({ balance: 1000, monthlyDeposit: 100, years: 1, grossReturnPct: 0, benchmark: { depositPct: 0, accumulationPct: 0 } });
    expect(r.endBalanceActual).toBeCloseTo(2200, 6);
    expect(r.costVsBenchmark).toBe(0);
  });
});

describe("hishtalmut liquidity", () => {
  it("uses the statement date when present", () => {
    expect(hishtalmutLiquidity({ liquidityDate: "2026-01-01" }, asOf)).toMatchObject({ status: "liquid", basis: "statement" });
    const locked = hishtalmutLiquidity({ liquidityDate: "2027-05-21" }, asOf);
    expect(locked).toMatchObject({ status: "locked", monthsRemaining: 6 });
  });

  it("falls back to open date + 6 years", () => {
    expect(hishtalmutLiquidity({ openDate: "01/02/2022" }, asOf)).toMatchObject({
      status: "locked",
      liquidityDate: "2028-02-01",
      basis: "openDate+6y",
    });
    expect(hishtalmutLiquidity({}, asOf).status).toBe("unknown");
  });
});

describe("retirement", () => {
  it("defaults the target age to 67 and records the assumption", () => {
    const t = retirementTiming({ key: "x", role: "adult", birthDate: "1980-01-01" }, asOf);
    expect(t).toMatchObject({ age: 46, targetRetirementAge: DEFAULT_RETIREMENT_AGE, targetAgeAssumed: true, yearsToRetirement: 21 });
    expect(t.assumptions.join(" ")).toMatch(/67/);
  });

  it("uses an explicit target age", () => {
    const t = retirementTiming({ key: "x", role: "adult", birthDate: "1980-01-01", targetRetirementAge: 60 }, asOf);
    expect(t).toMatchObject({ targetAgeAssumed: false, yearsToRetirement: 14 });
  });

  it("compounds balance + contributions monthly", () => {
    const r = projectRetirement({ currentBalance: 1000, monthlyContribution: 0, years: 1, realReturnPct: 12 });
    expect(r.projectedBalance).toBeCloseTo(1120, 0);
    const z = projectRetirement({ currentBalance: 0, monthlyContribution: 100, years: 2, realReturnPct: 0 });
    expect(z.projectedBalance).toBe(2400);
    expect(z.timeline).toHaveLength(3);
    expect(z.monthlyIncomeEstimate).toBe(8); // 2400 * 4% / 12
  });

  it("uses the conversion factor for income when given", () => {
    const r = projectRetirement({ currentBalance: 200000, monthlyContribution: 0, years: 0, conversionFactor: 200 });
    expect(r.monthlyIncomeEstimate).toBe(1000);
    expect(r.incomeMethod).toBe("conversionFactor");
  });
});

describe("children", () => {
  it("computes 18/21 milestones and savings-for-every-child presence", () => {
    const members: HouseholdMember[] = [
      { key: "adult_a", role: "adult" },
      { key: "kid1", role: "child", birthDate: "2010-06-01" },
      { key: "kid2", role: "child" },
    ];
    const res = childMilestones(members, [{ owner: "kid1", type: "savings_child", balanceUsd: 5000 }], asOf);
    expect(res).toHaveLength(2);
    expect(res[0]).toMatchObject({ age: 16, turns18: "2028-06-01", turns21: "2031-06-01", hasSavingsForEveryChildAccount: true, savingsForEveryChildBalanceUsd: 5000 });
    expect(res[1]).toMatchObject({ age: null, hasSavingsForEveryChildAccount: false });
  });
});

describe("rsu (equity comp) accounts", () => {
  it("count only the vested-and-held balance and are not flagged for missing fees", () => {
    const payload = buildNetWorth({
      asOf,
      fx,
      savings: [
        acct({
          id: "rsu",
          type: "rsu",
          country: "US",
          currency: "USD",
          balance: 9085, // 100 vested shares held @ 90.85
          details: { unvestedShares: 200, unvestedValue: 18170 },
        }),
      ],
      properties: [],
      trade: null,
    });
    expect(payload.byModule.savingsUsd).toBe(9085);
    expect(payload.byType.rsu).toBe(9085);
    expect(payload.dataGaps.some((g) => g.startsWith("Fees missing"))).toBe(false);
  });

  it("is an accepted account type", async () => {
    const { createSavingsAccountSchema } = await import("../../src/lib/savings-validators");
    const res = createSavingsAccountSchema.safeParse({
      owner: "asaf",
      country: "US",
      type: "rsu",
      provider: "Morgan Stanley at Work",
      currency: "USD",
      balance: 0,
    });
    expect(res.success).toBe(true);
  });
});

describe("buildNetWorth", () => {
  const payload = buildNetWorth({
    asOf,
    fx,
    savings: [
      acct({ id: "p", balance: 400000, feeDepositPct: 1.5, feeAccumulationPct: 0.3, monthlyDepositTotal: 4000 }),
      acct({ id: "h", type: "hishtalmut", owner: "adult_b", balance: 40000, liquidityDate: "2025-01-01", feeAccumulationPct: 0.7 }),
      acct({ id: "k", type: "401k", country: "US", currency: "USD", balance: 50000, feeAccumulationPct: 0.05 }),
      acct({ id: "old", balance: 999999, archivedAt: "2026-01-01T00:00:00Z" }),
    ],
    properties: [
      { id: "r1", title: "Rental 1", currentValue: 300000, purchasePrice: 200000, valueAsOf: null, mortgageBalance: 100000, mortgageAsOf: null },
      { id: "r2", title: "Rental 2", currentValue: null, purchasePrice: 150000, valueAsOf: null, mortgageBalance: null, mortgageAsOf: null },
    ],
    trade: { startingBalance: 100000, realizedPnL: 5000, netFunds: -10000 },
    snapshots: [
      { savingsAccountId: "p", asOf: "2026-05-31", balance: 360000 },
      { savingsAccountId: "p", asOf: "2026-10-31", balance: 400000 },
      { savingsAccountId: "k", asOf: "2026-09-30", balance: 48000 },
    ],
  });

  it("aggregates savings in USD, ignoring archived accounts", () => {
    expect(payload.savings.accounts).toHaveLength(3);
    expect(payload.byModule.savingsUsd).toBe(100000 + 10000 + 50000);
    expect(payload.byOwner).toEqual({ adult_a: 150000, adult_b: 10000 });
    expect(payload.byCountry).toEqual({ IL: 110000, US: 50000 });
    expect(payload.byType.hishtalmut).toBe(10000);
  });

  it("computes property equity and falls back to purchase price", () => {
    expect(payload.byModule.propertiesValueUsd).toBe(450000);
    expect(payload.byModule.mortgagesUsd).toBe(100000);
    expect(payload.byModule.propertiesEquityUsd).toBe(350000);
    expect(payload.properties[1].valueSource).toBe("purchasePrice");
  });

  it("totals net worth across modules", () => {
    expect(payload.byModule.tradeUsd).toBe(95000);
    expect(payload.totals.assetsUsd).toBe(160000 + 450000 + 95000);
    expect(payload.totals.liabilitiesUsd).toBe(100000);
    expect(payload.totals.netWorthUsd).toBe(605000);
    expect(payload.totals.netWorthIls).toBe(605000 * 4);
  });

  it("attaches fees, fee drag and liquidity per account", () => {
    const p = payload.savings.accounts.find((a) => a.id === "p")!;
    expect(p.annualFees.total).toBe(4000 * 12 * 0.015 + 400000 * 0.003);
    expect(p.annualFees.totalUsd).toBe(p.annualFees.total / 4);
    expect(p.feeDrag10y?.costVsBenchmark).toBeGreaterThan(0);
    expect(payload.savings.accounts.find((a) => a.id === "h")!.liquidity?.status).toBe("liquid");
    expect(p.liquidity).toBeNull();
  });

  it("reports data gaps", () => {
    expect(payload.dataGaps.some((g) => g.includes("Rental 2") && g.includes("purchase price"))).toBe(true);
    expect(payload.dataGaps.some((g) => g.includes("Mortgage balance unknown for Rental 2"))).toBe(true);
  });

  it("builds carry-forward savings history", () => {
    expect(payload.history).toEqual([
      { month: "2026-05", savingsUsd: 90000 },
      { month: "2026-09", savingsUsd: 90000 + 48000 },
      { month: "2026-10", savingsUsd: 100000 + 48000 },
    ]);
  });

  it("handles a missing trade account", () => {
    const p = buildNetWorth({ asOf, fx, savings: [], properties: [], trade: null });
    expect(p.totals.netWorthUsd).toBe(0);
    expect(p.dataGaps).toContain("Trade account not available.");
    expect(savingsHistory([], [], fx)).toEqual([]);
  });
});

describe("findCoverageOverlaps", () => {
  const members: HouseholdMember[] = [
    { key: "adult_a", role: "adult" },
    { key: "adult_b", role: "adult" },
    { key: "kid1", role: "child" },
  ];
  const benefits: BenefitLite[] = [
    { id: "b1", owner: "adult_a", country: "US", source: "employer:Acme", category: "life", coverageAmount: 200000, coverageCurrency: "USD", monthlyCost: 0 },
    { id: "b2", owner: "adult_a", country: "IL", source: "Sample Insurer", category: "life", coverageAmount: 800000, coverageCurrency: "ILS", monthlyCost: 120, costCurrency: "ILS" },
    { id: "b3", owner: "adult_a", country: "IL", source: "Sample Pension Co", category: "life", coverageAmount: 400000, coverageCurrency: "ILS", monthlyCost: 40, linkedSavingsAccountId: "p" },
    { id: "b4", owner: "adult_a", country: "US", source: "employer:Acme", category: "ltd", coverageAmount: 5000, coverageCurrency: "USD", monthlyCost: 20, costCurrency: "USD" },
    { id: "b5", owner: "adult_a", country: "IL", source: "Sample Pension Co", category: "work_capacity", coverageAmount: 20000, coverageCurrency: "ILS", monthlyCost: 40, linkedSavingsAccountId: "p" },
    { id: "b6", owner: "adult_b", country: "US", source: "employer:Acme", category: "dental", monthlyCost: 30, costCurrency: "USD" },
    { id: "b7", owner: "adult_b", country: "US", source: "employer:Acme", category: "life", archivedAt: "2026-01-01" },
  ];
  const r = findCoverageOverlaps(benefits, members, fx);

  it("groups life cover across countries and sums in USD", () => {
    const life = r.groups.find((g) => g.owner === "adult_a" && g.risk === "death")!;
    expect(life.count).toBe(3);
    expect(life.countries.sort()).toEqual(["IL", "US"]);
    expect(life.totalCoverageUsd).toBe(200000 + 200000 + 100000);
    expect(life.monthlyCostUsd).toBe(40);
    expect(life.duplicate).toBe(true);
    expect(life.items.filter((i) => i.insideSavingsAccount)).toHaveLength(1);
  });

  it("treats US LTD and Israeli loss-of-work-capacity as the same risk", () => {
    const dis = r.duplicates.find((g) => g.owner === "adult_a" && g.risk === "disability")!;
    expect(dis.categories.sort()).toEqual(["ltd", "work_capacity"]);
  });

  it("does not flag single or additive benefits as duplicates", () => {
    expect(r.groups.find((g) => g.risk === "dental")?.duplicate).toBe(false);
  });

  it("flags adults missing death or disability cover (ignores archived rows and children)", () => {
    expect(r.gaps.map((g) => `${g.owner}:${g.risk}`).sort()).toEqual(["adult_b:death", "adult_b:disability"]);
  });

  it("sums total monthly cost", () => {
    expect(r.totalMonthlyCostUsd).toBe(40 + 20 + 10 + 30);
  });
});

describe("policyLast4", () => {
  it("keeps only the last four digits", () => {
    expect(policyLast4("AB-12-345678")).toBe("5678");
    expect(policyLast4(987)).toBe("987");
    expect(policyLast4("none")).toBeNull();
    expect(policyLast4(null)).toBeNull();
  });
});
