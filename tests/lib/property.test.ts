import { describe, expect, it } from "vitest";

import {
  PROPERTY_CATEGORIES,
  buildingCashByProperty,
  buildingKey,
  cashOnCashPct,
  categoryLabel,
  composeAddress,
  computeAppreciation,
  computeSaleScenario,
  currentTenantOf,
  forReturns,
  getCategory,
  isCurrentTenant,
  monthlyNet,
  monthsElapsed,
  occupancyForYear,
  propertyTitle,
  signedAmount,
  sortTenantsByRecency,
  summarizeYear,
  taxOnlyCount,
  yieldPct,
  type PropertyTransactionDTO,
  type TenantDTO,
} from "../../src/lib/property";

// ---------------------------------------------------------------------------
// Fixtures — modeled on the real Rockdale County duplex in the production data.
// ---------------------------------------------------------------------------

const LAUREL_UNIT_1 = "1053 Laurel Ct NW, Unit 1, Rockdale County, GA, 30012, US";
const LAUREL_UNIT_2 = "1053 Laurel Ct NW, Unit 2, Rockdale County, GA, 30012, US";
/** The key both Laurel units collapse to when only `address` is populated. */
// buildingKey reduces BOTH the structured parts and the raw `address` string
// to this one canonical `street|state|zip` shape, so a building never splits
// just because its units carry their address in different columns.
const LAUREL_KEY = "1053 laurel ct nw|ga|30012";

function tenant(over: Partial<TenantDTO> & Pick<TenantDTO, "id" | "leaseStart">): TenantDTO {
  return {
    propertyId: "prop-1",
    name: "Tenant",
    email: null,
    phone: null,
    leaseEnd: null,
    monthlyRent: 1500,
    securityDeposit: 1500,
    notes: null,
    ...over,
  };
}

let txSeq = 0;
function tx(over: Partial<PropertyTransactionDTO>): PropertyTransactionDTO {
  txSeq += 1;
  return {
    id: `tx-${txSeq}`,
    propertyId: "prop-1",
    date: "2025-06-01",
    year: 2025,
    month: 6,
    type: "EXPENSE",
    category: "REPAIRS",
    amount: 100,
    description: null,
    taxOnly: false,
    ...over,
  };
}

/** Rows written before the `taxOnly` column existed: the key is simply absent. */
type LegacyTx = Omit<PropertyTransactionDTO, "taxOnly"> & { taxOnly?: boolean };

function legacyTx(over: Partial<LegacyTx>): LegacyTx {
  const row = tx(over as Partial<PropertyTransactionDTO>);
  const { taxOnly: _dropped, ...rest } = row;
  void _dropped;
  return rest;
}

// ---------------------------------------------------------------------------
// buildingKey
// ---------------------------------------------------------------------------

describe("buildingKey", () => {
  it("collapses the two units of an imported duplex that only has `address`", () => {
    const u1 = buildingKey({ id: "p1", address: LAUREL_UNIT_1 });
    const u2 = buildingKey({ id: "p2", address: LAUREL_UNIT_2 });
    expect(u1).toBe(LAUREL_KEY);
    expect(u2).toBe(LAUREL_KEY);
    expect(u1).toBe(u2);
  });

  it.each([
    ["#2", "1053 Laurel Ct NW, #2, Rockdale County, GA, 30012, US"],
    ["# 2 (spaced)", "1053 Laurel Ct NW, # 2, Rockdale County, GA, 30012, US"],
    ["Apt 4B", "1053 Laurel Ct NW, Apt 4B, Rockdale County, GA, 30012, US"],
    ["Apartment 4B", "1053 Laurel Ct NW, Apartment 4B, Rockdale County, GA, 30012, US"],
    ["Suite C", "1053 Laurel Ct NW, Suite C, Rockdale County, GA, 30012, US"],
    ["Ste. C", "1053 Laurel Ct NW, Ste. C, Rockdale County, GA, 30012, US"],
    ["Bldg 3", "1053 Laurel Ct NW, Bldg 3, Rockdale County, GA, 30012, US"],
    ["UNIT 12 (uppercase)", "1053 Laurel Ct NW, UNIT 12, Rockdale County, GA, 30012, US"],
  ])("strips the %s unit segment from a comma address", (_label, address) => {
    expect(buildingKey({ id: "x", address })).toBe(LAUREL_KEY);
  });

  it("normalizes case, padding and runs of whitespace inside the address", () => {
    expect(
      buildingKey({
        id: "p1",
        address: "  1053 LAUREL   Ct NW ,  UNIT 1 , Rockdale County , GA , 30012 , US ",
      })
    ).toBe(LAUREL_KEY);
  });

  it("keeps different buildings apart", () => {
    expect(buildingKey({ id: "p1", address: LAUREL_UNIT_1 })).not.toBe(
      buildingKey({ id: "p2", address: "1055 Laurel Ct NW, Unit 1, Rockdale County, GA, 30012, US" })
    );
  });

  it("builds a pipe-joined key from the structured street + city/state/zip", () => {
    expect(
      buildingKey({
        id: "p1",
        street: "1053 Laurel Ct NW",
        city: "Rockdale County",
        state: "GA",
        zip: "30012",
      })
    ).toBe(LAUREL_KEY);
  });

  it("omits blank city/state/zip parts from the structured key", () => {
    expect(buildingKey({ id: "p1", street: "1053 Laurel Ct NW", city: "", state: null })).toBe(
      "1053 laurel ct nw"
    );
  });

  it("folds city in when neither state nor zip is recorded, so towns stay apart", () => {
    const springfield = buildingKey({ id: "p1", street: "123 Main St", city: "Springfield" });
    const shelbyville = buildingKey({ id: "p2", street: "123 Main St", city: "Shelbyville" });
    expect(springfield).not.toBe(shelbyville);
    // ...and that degenerate case still matches its address-only twin.
    expect(springfield).toBe(buildingKey({ id: "p3", address: "123 Main St, Springfield" }));
  });

  it("prefers the structured street over `address` when both are present", () => {
    expect(
      buildingKey({ id: "p1", street: "1053 Laurel Ct NW", address: "totally different place" })
    ).toBe("1053 laurel ct nw");
  });

  it.each([
    ["1053 Laurel Ct NW Unit 2"],
    ["1053 Laurel Ct NW, Unit 2"],
    ["1053 Laurel Ct NW #2"],
    ["1053 Laurel Ct NW, #2"],
    ["1053 Laurel Ct NW Apt 4B"],
    ["1053 Laurel Ct NW Suite C"],
    ["1053 Laurel Ct NW  ste. c  "],
  ])("strips a unit token typed into the street field: %s", (street) => {
    expect(buildingKey({ id: "x", street, city: "Rockdale County", state: "GA", zip: "30012" })).toBe(
      LAUREL_KEY
    );
  });

  it("groups units whose unit token lives in `unit` vs. appended to `street`", () => {
    // `unit` is deliberately not part of the key, so these two land together.
    const a = buildingKey({ id: "p1", street: "1053 Laurel Ct NW", city: "Conyers", state: "GA" });
    const b = buildingKey({
      id: "p2",
      street: "1053 Laurel Ct NW Unit 2",
      city: "Conyers",
      state: "GA",
    });
    expect(a).toBe(b);
  });

  it("treats whitespace-only street as missing and falls through to the address", () => {
    expect(buildingKey({ id: "p1", street: "   ", address: LAUREL_UNIT_1 })).toBe(
      LAUREL_KEY
    );
  });

  it("falls back to the property id when there is no address at all, so two blanks never collide", () => {
    const a = buildingKey({ id: "prop-a" });
    const b = buildingKey({ id: "prop-b", address: "", street: "   ", city: null, zip: null });
    expect(a).toBe("prop-a");
    expect(b).toBe("prop-b");
    expect(a).not.toBe(b);
  });

  // --- documented current behavior (see report) ------------------------------

  it("groups a street-only unit with an address-only unit of the SAME building", () => {
    // Regression guard. These two formats once produced different keys (" | " vs
    // ", "), so editing one unit's address parts in the UI silently split the
    // building and halved its cash-on-cash. Both must reduce to one key.
    const structured = buildingKey({
      id: "p1",
      street: "1053 Laurel Ct NW",
      city: "Rockdale County",
      state: "GA",
      zip: "30012",
    });
    const imported = buildingKey({ id: "p2", address: LAUREL_UNIT_1 });
    expect(structured).toBe(LAUREL_KEY);
    expect(imported).toBe(LAUREL_KEY);
    expect(structured).toBe(imported);
  });

  it.each([
    ["7 Bldg Way", "7 bldg way|ga"],
    ["12 Suite Court", "12 suite court|ga"],
    ["9 Apartment Row", "9 apartment row|ga"],
  ])("keeps a street whose last words merely look like a unit token: %s", (street, expected) => {
    // A unit designator must carry an identifier (a digit, or a lone letter).
    // "Way" / "Court" / "Row" are neither, so the street name survives intact.
    expect(buildingKey({ id: "p1", street, city: "Conyers", state: "GA" })).toBe(expected);
  });

  it("is unperturbed by a bare 'Unit' segment that carries no identifier", () => {
    // "Unit" with no number names nothing, so it is no longer treated as a unit
    // designator. It cannot shift the key either way: only the street, state and
    // ZIP contribute, and the street is the first segment regardless.
    expect(buildingKey({ id: "p1", address: "9 Main St, Unit, Conyers, GA" })).toBe(
      "9 main st|ga"
    );
    expect(buildingKey({ id: "p2", address: "9 Main St, Conyers, GA" })).toBe("9 main st|ga");
  });
});

// ---------------------------------------------------------------------------
// cashOnCashPct
// ---------------------------------------------------------------------------

describe("cashOnCashPct", () => {
  it("returns net as a percentage of the cash invested", () => {
    expect(cashOnCashPct(6_000, 40_000)).toBe(15);
    expect(cashOnCashPct(40_000, 40_000)).toBe(100);
  });

  it("returns a negative percentage for a losing year", () => {
    expect(cashOnCashPct(-4_000, 40_000)).toBe(-10);
  });

  it.each([
    ["null down payment", null],
    ["zero down payment", 0],
    ["negative down payment", -25_000],
  ])("returns null for a %s", (_label, down) => {
    expect(cashOnCashPct(5_000, down)).toBeNull();
  });

  it("returns 0 for a zero net against real cash", () => {
    expect(cashOnCashPct(0, 40_000)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// buildingCashByProperty
// ---------------------------------------------------------------------------

describe("buildingCashByProperty", () => {
  it("sums net and down payments across the units of one building", () => {
    const byProp = buildingCashByProperty([
      { id: "p1", address: LAUREL_UNIT_1, downPayment: 40_000, net: 9_000 },
      { id: "p2", address: LAUREL_UNIT_2, downPayment: 20_000, net: -3_000 },
    ]);
    const stats = byProp.get("p1");
    expect(stats).toEqual({
      net: 6_000,
      downPayment: 60_000,
      unitCount: 2,
      cashOnCashPct: 10,
    });
  });

  it("hands every unit of a building the very same stats object", () => {
    const byProp = buildingCashByProperty([
      { id: "p1", address: LAUREL_UNIT_1, downPayment: 40_000, net: 9_000 },
      { id: "p2", address: LAUREL_UNIT_2, downPayment: 20_000, net: -3_000 },
    ]);
    expect(byProp.get("p1")).toBe(byProp.get("p2"));
  });

  it("keeps separate buildings separate and reports unitCount 1 for a single unit", () => {
    const byProp = buildingCashByProperty([
      { id: "p1", address: LAUREL_UNIT_1, downPayment: 40_000, net: 9_000 },
      { id: "p2", address: LAUREL_UNIT_2, downPayment: 20_000, net: -3_000 },
      { id: "solo", street: "88 Peachtree Rd", city: "Atlanta", state: "GA", downPayment: 50_000, net: 5_000 },
    ]);
    expect(byProp.size).toBe(3);
    expect(byProp.get("solo")).toEqual({
      net: 5_000,
      downPayment: 50_000,
      unitCount: 1,
      cashOnCashPct: 10,
    });
    expect(byProp.get("solo")).not.toBe(byProp.get("p1"));
  });

  it("treats a missing down payment as zero when summing", () => {
    const byProp = buildingCashByProperty([
      { id: "p1", address: LAUREL_UNIT_1, downPayment: null, net: 4_000 },
      { id: "p2", address: LAUREL_UNIT_2, downPayment: 30_000, net: 2_000 },
    ]);
    expect(byProp.get("p2")).toMatchObject({ downPayment: 30_000, net: 6_000, unitCount: 2 });
    expect(byProp.get("p2")?.cashOnCashPct).toBeCloseTo(20, 10);
  });

  it("yields cashOnCashPct null when no unit of the building recorded a down payment", () => {
    const byProp = buildingCashByProperty([
      { id: "p1", address: LAUREL_UNIT_1, downPayment: null, net: 4_000 },
      { id: "p2", address: LAUREL_UNIT_2, downPayment: 0, net: 2_000 },
    ]);
    expect(byProp.get("p1")).toEqual({
      net: 6_000,
      downPayment: 0,
      unitCount: 2,
      cashOnCashPct: null,
    });
  });

  it("reports a negative building return when the units lost money on net", () => {
    const byProp = buildingCashByProperty([
      { id: "p1", address: LAUREL_UNIT_1, downPayment: 30_000, net: -2_000 },
      { id: "p2", address: LAUREL_UNIT_2, downPayment: 10_000, net: -6_000 },
    ]);
    expect(byProp.get("p1")).toEqual({
      net: -8_000,
      downPayment: 40_000,
      unitCount: 2,
      cashOnCashPct: -20,
    });
  });

  it("never merges addressless properties — each keeps its own id as the key", () => {
    const byProp = buildingCashByProperty([
      { id: "p1", downPayment: 10_000, net: 1_000 },
      { id: "p2", downPayment: 20_000, net: 2_000 },
    ]);
    expect(byProp.get("p1")).toEqual({
      net: 1_000,
      downPayment: 10_000,
      unitCount: 1,
      cashOnCashPct: 10,
    });
    expect(byProp.get("p2")?.unitCount).toBe(1);
  });

  it("returns an empty map for no properties", () => {
    expect(buildingCashByProperty([]).size).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// forReturns / taxOnlyCount
// ---------------------------------------------------------------------------

describe("forReturns / taxOnlyCount", () => {
  const rows = [
    tx({ id: "a", type: "INCOME", category: "RENT", amount: 1_500, taxOnly: false }),
    tx({ id: "b", category: "DEPRECIATION", amount: 5_000, taxOnly: true }),
    tx({ id: "c", category: "REPAIRS", amount: 320, taxOnly: false }),
    tx({ id: "d", category: "MORTGAGE_INTEREST", amount: 900, taxOnly: true }),
  ];

  it("drops tax-only entries from the performance view", () => {
    expect(forReturns(rows).map((r) => r.id)).toEqual(["a", "c"]);
  });

  it("counts the tax-only entries", () => {
    expect(taxOnlyCount(rows)).toBe(2);
  });

  it("does not mutate or reorder the input list", () => {
    const input = [...rows];
    forReturns(input);
    expect(input.map((r) => r.id)).toEqual(["a", "b", "c", "d"]);
  });

  it("keeps legacy rows that have no taxOnly field at all", () => {
    const legacy = legacyTx({ id: "legacy", type: "INCOME", category: "RENT", amount: 1_200 });
    expect("taxOnly" in legacy).toBe(false);
    const mixed: LegacyTx[] = [
      legacy,
      { ...legacyTx({ id: "modern" }), taxOnly: true },
    ];
    expect(forReturns(mixed).map((r) => r.id)).toEqual(["legacy"]);
    expect(taxOnlyCount(mixed)).toBe(1);
  });

  it("counts zero tax-only rows in an all-legacy list", () => {
    const legacy = [legacyTx({ id: "l1" }), legacyTx({ id: "l2" })];
    expect(taxOnlyCount(legacy)).toBe(0);
    expect(forReturns(legacy)).toHaveLength(2);
  });

  it("handles empty input", () => {
    expect(forReturns([])).toEqual([]);
    expect(taxOnlyCount([])).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// summarizeYear
// ---------------------------------------------------------------------------

describe("summarizeYear", () => {
  const rows = [
    tx({ year: 2025, type: "INCOME", category: "RENT", amount: 1_500 }),
    tx({ year: 2025, type: "INCOME", category: "RENT", amount: 1_500 }),
    tx({ year: 2025, type: "INCOME", category: "OTHER_INCOME", amount: 75 }),
    tx({ year: 2025, type: "EXPENSE", category: "UTILITIES", amount: 210 }),
    tx({ year: 2025, type: "EXPENSE", category: "REPAIRS", amount: 640 }),
    tx({ year: 2025, type: "EXPENSE", category: "MORTGAGE_INTEREST", amount: 1_100 }),
    tx({ year: 2024, type: "INCOME", category: "RENT", amount: 9_999 }),
    tx({ year: 2026, type: "EXPENSE", category: "REPAIRS", amount: 8_888 }),
  ];

  it("totals income, expenses and net for the requested year only", () => {
    const s = summarizeYear(rows, 2025);
    expect(s.income).toBe(3_075);
    expect(s.expenses).toBe(1_950);
    expect(s.net).toBe(1_125);
  });

  it("ignores transactions from other years", () => {
    expect(summarizeYear(rows, 2024)).toMatchObject({ income: 9_999, expenses: 0, net: 9_999 });
    expect(summarizeYear(rows, 2026)).toMatchObject({ income: 0, expenses: 8_888, net: -8_888 });
  });

  it("returns a zeroed summary for a year with no data", () => {
    expect(summarizeYear(rows, 2019)).toEqual({
      income: 0,
      expenses: 0,
      net: 0,
      byCategory: [],
    });
  });

  it("rolls categories up and keeps the PROPERTY_CATEGORIES catalog order", () => {
    const s = summarizeYear(rows, 2025);
    expect(s.byCategory).toEqual([
      { key: "RENT", label: "Rental income", type: "INCOME", total: 3_000 },
      { key: "OTHER_INCOME", label: "Other income", type: "INCOME", total: 75 },
      {
        key: "MORTGAGE_INTEREST",
        label: "Mortgage interest",
        type: "EXPENSE",
        total: 1_100,
      },
      { key: "REPAIRS", label: "Repairs", type: "EXPENSE", total: 640 },
      { key: "UTILITIES", label: "Utilities", type: "EXPENSE", total: 210 },
    ]);
  });

  it("orders byCategory by the catalog, not by the order rows arrive in", () => {
    const shuffled = [
      tx({ year: 2025, type: "EXPENSE", category: "HOA", amount: 300 }),
      tx({ year: 2025, type: "EXPENSE", category: "ADVERTISING", amount: 50 }),
      tx({ year: 2025, type: "INCOME", category: "RENT", amount: 1_000 }),
      tx({ year: 2025, type: "EXPENSE", category: "PROPERTY_TAX", amount: 1_400 }),
    ];
    expect(summarizeYear(shuffled, 2025).byCategory.map((c) => c.key)).toEqual([
      "RENT",
      "ADVERTISING",
      "PROPERTY_TAX",
      "HOA",
    ]);
    const catalogOrder = PROPERTY_CATEGORIES.map((c) => c.key);
    expect(catalogOrder.indexOf("ADVERTISING")).toBeLessThan(catalogOrder.indexOf("PROPERTY_TAX"));
  });

  it("keeps tax-only rows in the summary (the tax view reads the unfiltered list)", () => {
    const withTaxOnly = [
      tx({ year: 2025, type: "INCOME", category: "RENT", amount: 1_000, taxOnly: false }),
      tx({ year: 2025, type: "EXPENSE", category: "DEPRECIATION", amount: 4_000, taxOnly: true }),
    ];
    expect(summarizeYear(withTaxOnly, 2025).net).toBe(-3_000);
    expect(summarizeYear(forReturns(withTaxOnly), 2025).net).toBe(1_000);
  });

  it("lists a category outside the catalog so the lines still sum to the net", () => {
    // Regression guard. `byCategory` is built by filtering the catalog, so an
    // unrecognized key (stale import, renamed category) once moved the totals
    // while vanishing from the breakdown — the tax lines failed to sum to the
    // net printed beneath them. Unknown keys are appended after the catalog rows.
    const s = summarizeYear(
      [
        tx({ year: 2025, type: "EXPENSE", category: "MYSTERY_FEE", amount: 100 }),
        tx({ year: 2025, type: "INCOME", category: "RENT", amount: 1_000 }),
      ],
      2025
    );
    expect(s.expenses).toBe(100);
    expect(s.net).toBe(900);
    expect(s.byCategory.map((c) => c.key)).toEqual(["RENT", "MYSTERY_FEE"]);
    const mystery = s.byCategory.find((c) => c.key === "MYSTERY_FEE");
    expect(mystery).toMatchObject({ type: "EXPENSE", total: 100, label: "MYSTERY_FEE" });
    const lineSum = s.byCategory.reduce(
      (n, c) => n + (c.type === "INCOME" ? c.total : -c.total),
      0
    );
    expect(lineSum).toBe(s.net);
  });

  it("sorts multiple unknown categories stably after the catalog rows", () => {
    const s = summarizeYear(
      [
        tx({ year: 2025, type: "EXPENSE", category: "ZETA_FEE", amount: 10 }),
        tx({ year: 2025, type: "EXPENSE", category: "ALPHA_FEE", amount: 20 }),
        tx({ year: 2025, type: "INCOME", category: "RENT", amount: 100 }),
      ],
      2025
    );
    expect(s.byCategory.map((c) => c.key)).toEqual(["RENT", "ALPHA_FEE", "ZETA_FEE"]);
  });
});

// ---------------------------------------------------------------------------
// signedAmount / monthlyNet / monthsElapsed / yieldPct
// ---------------------------------------------------------------------------

describe("signedAmount", () => {
  it("is positive for income and negative for expense", () => {
    expect(signedAmount({ type: "INCOME", amount: 1_500 })).toBe(1_500);
    expect(signedAmount({ type: "EXPENSE", amount: 320.5 })).toBe(-320.5);
  });

  it("negates a zero expense to zero", () => {
    expect(signedAmount({ type: "EXPENSE", amount: 0 })).toBe(-0);
  });
});

describe("monthlyNet", () => {
  it("returns 12 buckets of income minus expense", () => {
    const net = monthlyNet([
      { month: 1, type: "INCOME", amount: 1_500 },
      { month: 1, type: "EXPENSE", amount: 200 },
      { month: 6, type: "INCOME", amount: 1_500 },
      { month: 12, type: "EXPENSE", amount: 950 },
    ]);
    expect(net).toHaveLength(12);
    expect(net).toEqual([1_300, 0, 0, 0, 0, 1_500, 0, 0, 0, 0, 0, -950]);
  });

  it("returns all zeros for no transactions", () => {
    expect(monthlyNet([])).toEqual(Array(12).fill(0));
  });

  it("ignores out-of-range month numbers", () => {
    const net = monthlyNet([
      { month: 0, type: "INCOME", amount: 5_000 },
      { month: 13, type: "INCOME", amount: 5_000 },
      { month: 3, type: "INCOME", amount: 100 },
    ]);
    expect(net[2]).toBe(100);
    expect(net.reduce((a, b) => a + b, 0)).toBe(100);
  });
});

describe("monthsElapsed", () => {
  it("counts a full 12 for any past year", () => {
    expect(monthsElapsed(2024, "2026-09-21")).toBe(12);
    expect(monthsElapsed(1999, "2026-01-01")).toBe(12);
  });

  it("counts the current month number for the ongoing year", () => {
    expect(monthsElapsed(2026, "2026-09-21")).toBe(9);
    expect(monthsElapsed(2026, "2026-01-01")).toBe(1);
    expect(monthsElapsed(2026, "2026-12-31")).toBe(12);
  });

  it("counts zero for a future year", () => {
    expect(monthsElapsed(2027, "2026-09-21")).toBe(0);
  });
});

describe("yieldPct", () => {
  it("annualizes a partial year of net before dividing by purchase price", () => {
    // 6 months of $6k net → $12k annualized on a $200k purchase → 6%.
    expect(yieldPct(6_000, 200_000, 6)).toBe(6);
  });

  it("leaves a full year of net alone", () => {
    expect(yieldPct(12_000, 200_000, 12)).toBe(6);
  });

  it("goes negative when the property lost money", () => {
    expect(yieldPct(-5_000, 200_000, 12)).toBe(-2.5);
  });

  it.each([
    ["null price", null, 12],
    ["zero price", 0, 12],
    ["negative price", -200_000, 12],
    ["zero elapsed months", 200_000, 0],
    ["negative elapsed months", 200_000, -3],
  ])("returns null for %s", (_label, price, months) => {
    expect(yieldPct(10_000, price, months)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Tenants: isCurrentTenant / sortTenantsByRecency / currentTenantOf / occupancy
// ---------------------------------------------------------------------------

describe("isCurrentTenant", () => {
  const today = "2026-09-21";

  it("is true for an ongoing lease with no end date", () => {
    expect(isCurrentTenant(tenant({ id: "t1", leaseStart: "2025-01-01" }), today)).toBe(true);
  });

  it("is true on the last day of the lease", () => {
    expect(
      isCurrentTenant(tenant({ id: "t1", leaseStart: "2025-01-01", leaseEnd: today }), today)
    ).toBe(true);
  });

  it("is false the day after the lease ends", () => {
    expect(
      isCurrentTenant(
        tenant({ id: "t1", leaseStart: "2025-01-01", leaseEnd: "2026-09-20" }),
        today
      )
    ).toBe(false);
  });

  it("is true for a lease that ends in the future", () => {
    expect(
      isCurrentTenant(
        tenant({ id: "t1", leaseStart: "2026-01-01", leaseEnd: "2027-01-01" }),
        today
      )
    ).toBe(true);
  });

  it("is true for a lease that has not started yet (only the end date is checked)", () => {
    // Documented current behavior: a future lease reads as "current".
    expect(
      isCurrentTenant(
        tenant({ id: "t1", leaseStart: "2027-01-01", leaseEnd: "2028-01-01" }),
        today
      )
    ).toBe(true);
  });
});

describe("sortTenantsByRecency", () => {
  const a = tenant({ id: "a", leaseStart: "2023-03-01", leaseEnd: "2024-02-29" });
  const b = tenant({ id: "b", leaseStart: "2025-06-01", leaseEnd: null });
  const c = tenant({ id: "c", leaseStart: "2024-03-01", leaseEnd: "2025-05-31" });

  it("puts the newest lease start first", () => {
    expect(sortTenantsByRecency([a, b, c]).map((t) => t.id)).toEqual(["b", "c", "a"]);
  });

  it("does not mutate the caller's array", () => {
    const input = [a, b, c];
    sortTenantsByRecency(input);
    expect(input.map((t) => t.id)).toEqual(["a", "b", "c"]);
  });

  it("keeps the original order for identical lease starts", () => {
    const x = tenant({ id: "x", leaseStart: "2025-01-01" });
    const y = tenant({ id: "y", leaseStart: "2025-01-01" });
    expect(sortTenantsByRecency([x, y]).map((t) => t.id)).toEqual(["x", "y"]);
  });

  it("returns an empty array unchanged", () => {
    expect(sortTenantsByRecency([])).toEqual([]);
  });
});

describe("currentTenantOf", () => {
  const today = "2026-09-21";

  it("picks the most recent lease among the current ones", () => {
    const older = tenant({ id: "older", leaseStart: "2024-01-01", leaseEnd: null });
    const newer = tenant({ id: "newer", leaseStart: "2026-02-01", leaseEnd: null });
    expect(currentTenantOf([older, newer], today)?.id).toBe("newer");
  });

  it("skips tenants whose lease already ended", () => {
    const expired = tenant({ id: "expired", leaseStart: "2026-03-01", leaseEnd: "2026-08-31" });
    const active = tenant({ id: "active", leaseStart: "2025-01-01", leaseEnd: "2026-12-31" });
    expect(currentTenantOf([expired, active], today)?.id).toBe("active");
  });

  it("returns null when every lease has ended", () => {
    expect(
      currentTenantOf(
        [tenant({ id: "t1", leaseStart: "2023-01-01", leaseEnd: "2024-01-01" })],
        today
      )
    ).toBeNull();
  });

  it("returns null for a property with no tenants", () => {
    expect(currentTenantOf([], today)).toBeNull();
  });
});

describe("occupancyForYear", () => {
  const today = "2026-09-21";

  it("counts every month of a past year covered by an ongoing lease", () => {
    const t = tenant({ id: "t1", leaseStart: "2024-06-01", leaseEnd: null });
    expect(occupancyForYear([t], 2025, today)).toEqual({
      occupiedMonths: 12,
      totalMonths: 12,
      pct: 100,
    });
  });

  it("counts only the overlapped months of a partial-year lease", () => {
    // Apr 1 – Sep 30 2025 = 6 months of a 12-month year.
    const t = tenant({ id: "t1", leaseStart: "2025-04-01", leaseEnd: "2025-09-30" });
    const occ = occupancyForYear([t], 2025, today);
    expect(occ.occupiedMonths).toBe(6);
    expect(occ.totalMonths).toBe(12);
    expect(occ.pct).toBe(50);
  });

  it("measures the ongoing year against elapsed months only", () => {
    const t = tenant({ id: "t1", leaseStart: "2026-05-01", leaseEnd: null });
    // Elapsed = Jan–Sep (9). Occupied = May–Sep (5).
    expect(occupancyForYear([t], 2026, today)).toEqual({
      occupiedMonths: 5,
      totalMonths: 9,
      pct: (5 / 9) * 100,
    });
  });

  it("returns zeros for a year that has not started", () => {
    const t = tenant({ id: "t1", leaseStart: "2020-01-01", leaseEnd: null });
    expect(occupancyForYear([t], 2027, today)).toEqual({
      occupiedMonths: 0,
      totalMonths: 0,
      pct: 0,
    });
  });

  it("unions overlapping and back-to-back leases without double counting", () => {
    const first = tenant({ id: "t1", leaseStart: "2024-08-01", leaseEnd: "2025-05-31" });
    const second = tenant({ id: "t2", leaseStart: "2025-06-01", leaseEnd: "2025-12-31" });
    expect(occupancyForYear([first, second], 2025, today).occupiedMonths).toBe(12);
  });

  it("leaves a vacancy gap uncounted", () => {
    const first = tenant({ id: "t1", leaseStart: "2024-08-01", leaseEnd: "2025-03-31" });
    const second = tenant({ id: "t2", leaseStart: "2025-07-01", leaseEnd: "2025-12-31" });
    // Jan–Mar (3) + Jul–Dec (6) = 9; Apr–Jun vacant.
    const occ = occupancyForYear([first, second], 2025, today);
    expect(occ.occupiedMonths).toBe(9);
    expect(occ.pct).toBe(75);
  });

  it("counts the boundary month when a lease starts on the 1st or ends on the 1st", () => {
    const startsFirst = tenant({ id: "t1", leaseStart: "2025-03-01", leaseEnd: "2025-03-31" });
    expect(occupancyForYear([startsFirst], 2025, today).occupiedMonths).toBe(1);

    const endsFirst = tenant({ id: "t2", leaseStart: "2025-01-15", leaseEnd: "2025-03-01" });
    // Jan, Feb, Mar — March counts because the lease ends on the 1st.
    expect(occupancyForYear([endsFirst], 2025, today).occupiedMonths).toBe(3);
  });

  it("reports 0% for a year with no tenants at all", () => {
    expect(occupancyForYear([], 2025, today)).toEqual({
      occupiedMonths: 0,
      totalMonths: 12,
      pct: 0,
    });
  });

  it("ignores a lease that falls entirely outside the year", () => {
    const t = tenant({ id: "t1", leaseStart: "2023-01-01", leaseEnd: "2023-12-31" });
    expect(occupancyForYear([t], 2025, today).occupiedMonths).toBe(0);
  });

  it("counts the first month of a lease starting on the 29th–31st", () => {
    // Regression guard. Each month was probed with a fixed 28th as its end, so a
    // lease starting after the 28th was treated as not overlapping the month it
    // began in — understating occupancy for late-month move-ins.
    const t = tenant({ id: "t1", leaseStart: "2025-01-30", leaseEnd: "2025-06-15" });
    const occ = occupancyForYear([t], 2025, today);
    expect(occ.occupiedMonths).toBe(6); // Jan–Jun inclusive
    expect(occ.totalMonths).toBe(12);
  });

  it("counts the last month of a lease ending on the 29th–31st", () => {
    // The mirror case, which always worked — asserted so the two stay symmetric.
    const t = tenant({ id: "t1", leaseStart: "2025-01-01", leaseEnd: "2025-03-29" });
    expect(occupancyForYear([t], 2025, today).occupiedMonths).toBe(3);
  });

  it("counts a lease confined to the last day of a 31-, 30- and 28-day month", () => {
    for (const [start, label] of [
      ["2025-01-31", "Jan (31)"],
      ["2025-04-30", "Apr (30)"],
      ["2025-02-28", "Feb (28)"],
    ] as const) {
      const t = tenant({ id: "t1", leaseStart: start, leaseEnd: start });
      expect(occupancyForYear([t], 2025, today).occupiedMonths, label).toBe(1);
    }
  });
});

// ---------------------------------------------------------------------------
// composeAddress / propertyTitle
// ---------------------------------------------------------------------------

describe("composeAddress", () => {
  it("composes a full US address with a #-prefixed unit", () => {
    expect(
      composeAddress({
        street: "1053 Laurel Ct NW",
        unit: "2",
        city: "Conyers",
        state: "GA",
        zip: "30012",
      })
    ).toBe("1053 Laurel Ct NW #2, Conyers, GA 30012");
  });

  it("omits the unit when it is blank", () => {
    expect(
      composeAddress({ street: "1053 Laurel Ct NW", unit: "  ", city: "Conyers", state: "GA", zip: "30012" })
    ).toBe("1053 Laurel Ct NW, Conyers, GA 30012");
  });

  it("trims whitespace around each part", () => {
    expect(
      composeAddress({ street: "  1053 Laurel Ct NW ", unit: " 2 ", city: " Conyers ", state: " GA ", zip: " 30012 " })
    ).toBe("1053 Laurel Ct NW #2, Conyers, GA 30012");
  });

  it("skips a missing city", () => {
    expect(composeAddress({ street: "1053 Laurel Ct NW", state: "GA", zip: "30012" })).toBe(
      "1053 Laurel Ct NW, GA 30012"
    );
  });

  it("skips a missing state/zip", () => {
    expect(composeAddress({ street: "1053 Laurel Ct NW", city: "Conyers" })).toBe(
      "1053 Laurel Ct NW, Conyers"
    );
  });

  it("handles nulls and an entirely empty input", () => {
    expect(composeAddress({ street: null, unit: null, city: null, state: null, zip: null })).toBe("");
    expect(composeAddress({})).toBe("");
  });

  it("returns just the city/state block when there is no street", () => {
    expect(composeAddress({ city: "Conyers", state: "GA", zip: "30012" })).toBe("Conyers, GA 30012");
  });
});

describe("propertyTitle", () => {
  it("prefers the street", () => {
    expect(
      propertyTitle({ street: "1053 Laurel Ct NW", address: LAUREL_UNIT_1, nickname: "The duplex" })
    ).toBe("1053 Laurel Ct NW");
  });

  it("falls back to the full address when there is no street", () => {
    expect(propertyTitle({ street: "   ", address: LAUREL_UNIT_1, nickname: "The duplex" })).toBe(
      LAUREL_UNIT_1
    );
  });

  it("falls back to the nickname when there is neither street nor address", () => {
    expect(propertyTitle({ street: null, address: null, nickname: "The duplex" })).toBe("The duplex");
  });

  it("falls back to the literal 'Property' when everything is blank", () => {
    expect(propertyTitle({})).toBe("Property");
    expect(propertyTitle({ street: "", address: "  ", nickname: null })).toBe("Property");
  });

  it("trims the value it returns", () => {
    expect(propertyTitle({ street: "  1053 Laurel Ct NW  " })).toBe("1053 Laurel Ct NW");
  });
});

// ---------------------------------------------------------------------------
// computeAppreciation / computeSaleScenario
// ---------------------------------------------------------------------------

describe("computeAppreciation", () => {
  it("computes gain, total %, years, annualized % and return on the down payment", () => {
    const a = computeAppreciation({
      purchasePrice: 200_000,
      purchaseDate: "2020-01-01",
      currentValue: 300_000,
      valueAsOf: "2026-01-01",
      downPayment: 50_000,
    });
    expect(a).not.toBeNull();
    expect(a!.gain).toBe(100_000);
    expect(a!.totalPct).toBe(0.5);
    expect(a!.years).toBeCloseTo(6.0, 2);
    expect(a!.annualizedPct).toBeCloseTo(0.0699, 4);
    expect(a!.returnOnDownPct).toBe(2);
  });

  it("handles a value below the purchase price", () => {
    const a = computeAppreciation({
      purchasePrice: 200_000,
      purchaseDate: "2024-01-01",
      currentValue: 180_000,
      valueAsOf: "2026-01-01",
      downPayment: 40_000,
    });
    expect(a!.gain).toBe(-20_000);
    expect(a!.totalPct).toBeCloseTo(-0.1, 10);
    expect(a!.annualizedPct).toBeLessThan(0);
    expect(a!.returnOnDownPct).toBe(-0.5);
  });

  it("falls back to the total % when there is no purchase date (years = 0)", () => {
    const a = computeAppreciation({
      purchasePrice: 200_000,
      purchaseDate: null,
      currentValue: 260_000,
      valueAsOf: "2026-01-01",
      downPayment: null,
    });
    expect(a!.years).toBe(0);
    expect(a!.totalPct).toBeCloseTo(0.3, 10);
    expect(a!.annualizedPct).toBe(a!.totalPct);
    expect(a!.returnOnDownPct).toBeNull();
  });

  it("measures against today when valueAsOf is missing", () => {
    const oneYearAgo = new Date(Date.now() - 365.25 * 24 * 3600 * 1000)
      .toISOString()
      .slice(0, 10);
    const a = computeAppreciation({
      purchasePrice: 100_000,
      purchaseDate: oneYearAgo,
      currentValue: 110_000,
      valueAsOf: null,
      downPayment: null,
    });
    expect(a!.years).toBeGreaterThan(0.99);
    expect(a!.years).toBeLessThan(1.01);
    expect(a!.annualizedPct).toBeGreaterThan(0.09);
    expect(a!.annualizedPct).toBeLessThan(0.11);
  });

  it("clamps years at 0 when the value date precedes the purchase date", () => {
    const a = computeAppreciation({
      purchasePrice: 200_000,
      purchaseDate: "2026-01-01",
      currentValue: 220_000,
      valueAsOf: "2020-01-01",
      downPayment: null,
    });
    expect(a!.years).toBe(0);
    expect(a!.annualizedPct).toBe(a!.totalPct);
  });

  it.each([
    ["no purchase price", { purchasePrice: null, currentValue: 300_000 }],
    ["zero purchase price", { purchasePrice: 0, currentValue: 300_000 }],
    ["negative purchase price", { purchasePrice: -1, currentValue: 300_000 }],
    ["no current value", { purchasePrice: 200_000, currentValue: null }],
  ])("returns null with %s", (_label, over) => {
    expect(
      computeAppreciation({
        purchaseDate: "2020-01-01",
        valueAsOf: "2026-01-01",
        downPayment: 50_000,
        ...over,
      })
    ).toBeNull();
  });

  it("returns null return-on-down for a zero down payment", () => {
    const a = computeAppreciation({
      purchasePrice: 200_000,
      purchaseDate: "2020-01-01",
      currentValue: 300_000,
      valueAsOf: "2026-01-01",
      downPayment: 0,
    });
    expect(a!.returnOnDownPct).toBeNull();
  });
});

describe("computeSaleScenario", () => {
  it("applies the default 6% realtor + 2% closing assumptions", () => {
    const s = computeSaleScenario({
      purchasePrice: 200_000,
      currentValue: 300_000,
      downPayment: 50_000,
    });
    expect(s).toEqual({
      realtorPct: 0.06,
      closingPct: 0.02,
      realtorCost: 18_000,
      closingCost: 6_000,
      sellingCosts: 24_000,
      netProceeds: 276_000,
      netProfit: 76_000,
      netProfitPct: 0.38,
      cashOnCash: 1.52,
    });
  });

  it("honors custom cost percentages", () => {
    const s = computeSaleScenario(
      { purchasePrice: 200_000, currentValue: 300_000, downPayment: 50_000 },
      0.05,
      0.01
    );
    expect(s!.realtorCost).toBe(15_000);
    expect(s!.closingCost).toBe(3_000);
    expect(s!.netProceeds).toBe(282_000);
    expect(s!.netProfit).toBe(82_000);
    expect(s!.cashOnCash).toBeCloseTo(1.64, 10);
  });

  it("reports a loss when selling costs sink the sale below the basis", () => {
    const s = computeSaleScenario({
      purchasePrice: 300_000,
      currentValue: 300_000,
      downPayment: 60_000,
    });
    expect(s!.netProfit).toBe(-24_000);
    expect(s!.netProfitPct).toBeCloseTo(-0.08, 10);
    expect(s!.cashOnCash).toBeCloseTo(-0.4, 10);
  });

  it("treats a missing purchase price as a zero basis, so netProfitPct is 0", () => {
    const s = computeSaleScenario({
      purchasePrice: null,
      currentValue: 300_000,
      downPayment: 50_000,
    });
    expect(s!.netProfit).toBe(276_000);
    expect(s!.netProfitPct).toBe(0);
    expect(s!.cashOnCash).toBeCloseTo(5.52, 10);
  });

  it.each([
    ["null down payment", null],
    ["zero down payment", 0],
    ["negative down payment", -10],
  ])("returns cashOnCash null for a %s", (_label, down) => {
    const s = computeSaleScenario({
      purchasePrice: 200_000,
      currentValue: 300_000,
      downPayment: down,
    });
    expect(s!.cashOnCash).toBeNull();
  });

  it.each([
    ["null current value", null],
    ["zero current value", 0],
    ["negative current value", -1],
  ])("returns null entirely for a %s", (_label, value) => {
    expect(
      computeSaleScenario({ purchasePrice: 200_000, currentValue: value, downPayment: 50_000 })
    ).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Category catalog helpers
// ---------------------------------------------------------------------------

describe("category catalog", () => {
  it("looks a category up by key", () => {
    expect(getCategory("MORTGAGE_INTEREST")).toEqual({
      key: "MORTGAGE_INTEREST",
      label: "Mortgage interest",
      type: "EXPENSE",
      taxLine: "Line 12",
    });
  });

  it("returns undefined for an unknown key and echoes it back as its own label", () => {
    expect(getCategory("NOPE")).toBeUndefined();
    expect(categoryLabel("NOPE")).toBe("NOPE");
    expect(categoryLabel("HOA")).toBe("HOA / association dues");
  });

  it("has unique keys across the catalog", () => {
    const keys = PROPERTY_CATEGORIES.map((c) => c.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
