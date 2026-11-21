import { describe, expect, it } from "vitest";

import {
  appreciationOf,
  buildingTotals,
  equityOf,
  groupByBuilding,
  portfolioKpis,
  sortEntries,
} from "../../src/lib/property-portfolio";
import { stripUnitDesignator } from "../../src/lib/property";
import { row } from "./property-row-fixture";

describe("equityOf / appreciationOf", () => {
  it("treats a missing mortgage as $0 and needs a value", () => {
    expect(equityOf({ currentValue: 300_000, mortgageBalance: 100_000 })).toBe(200_000);
    expect(equityOf({ currentValue: 300_000, mortgageBalance: null })).toBe(300_000);
    expect(equityOf({ currentValue: null, mortgageBalance: 100_000 })).toBeNull();
  });
  it("needs both a value and a positive purchase price", () => {
    expect(appreciationOf({ currentValue: 330_000, purchasePrice: 300_000 })).toBeCloseTo(0.1);
    expect(appreciationOf({ currentValue: 330_000, purchasePrice: null })).toBeNull();
    expect(appreciationOf({ currentValue: null, purchasePrice: 300_000 })).toBeNull();
  });
});

describe("stripUnitDesignator", () => {
  it("drops a trailing unit and keeps a street that merely contains a unit word", () => {
    expect(stripUnitDesignator("12 Example Ave #2")).toBe("12 Example Ave");
    expect(stripUnitDesignator("12 Example Ave Unit 4B")).toBe("12 Example Ave");
    expect(stripUnitDesignator("7 Bldg Way")).toBe("7 Bldg Way");
  });
});

describe("groupByBuilding", () => {
  const a1 = row({ id: "a1", title: "12 Example Ave #1", unit: "1", buildingKey: "dup" });
  const solo = row({ id: "s" });
  const a2 = row({ id: "a2", title: "12 Example Ave #2", unit: "2", buildingKey: "dup" });

  it("keeps single-unit buildings as rows and groups units in first-seen order", () => {
    const entries = groupByBuilding([a1, solo, a2], 12);
    expect(entries.map((e) => e.kind)).toEqual(["building", "single"]);
    const b = entries[0];
    if (b.kind !== "building") throw new Error("expected building");
    expect(b.title).toBe("12 Example Ave");
    expect(b.units.map((u) => u.id)).toEqual(["a1", "a2"]);
  });

  it("returns nothing for no rows", () => {
    expect(groupByBuilding([], 12)).toEqual([]);
  });
});

describe("buildingTotals", () => {
  it("sums the money, counts leased units and keeps the shared cash-on-cash", () => {
    const u1 = row({
      id: "u1",
      income: 12_000,
      expenses: 4_000,
      net: 8_000,
      monthlyNet: [1000, 500, ...Array(10).fill(0)],
      currentValue: 200_000,
      purchasePrice: 160_000,
      mortgageBalance: 120_000,
      cashOnCashPct: 10,
      cashInvested: 100_000,
    });
    const u2 = row({
      id: "u2",
      income: 6_000,
      expenses: 4_000,
      net: 2_000,
      monthlyNet: [-200, 300, ...Array(10).fill(0)],
      currentValue: 200_000,
      purchasePrice: 160_000,
      mortgageBalance: null,
      currentTenantName: null,
      cashOnCashPct: 10,
      cashInvested: 100_000,
    });
    const t = buildingTotals([u1, u2], 12);
    expect(t.net).toBe(10_000);
    expect(t.income).toBe(18_000);
    expect(t.value).toBe(400_000);
    expect(t.valuedUnits).toBe(2);
    expect(t.mortgage).toBe(120_000);
    // Missing mortgage counts as $0 in equity, as everywhere else.
    expect(t.equity).toBe(280_000);
    expect(t.appreciationPct).toBeCloseTo(0.25);
    expect(t.yieldPct).toBeCloseTo((10_000 / 320_000) * 100);
    expect(t.cashOnCashPct).toBe(10);
    expect(t.leasedUnits).toBe(1);
    expect(t.units).toBe(2);
    expect(t.monthlyNet.slice(0, 2)).toEqual([800, 800]);
  });

  it("leaves value-based totals null when no unit has a value", () => {
    const t = buildingTotals([row({ id: "x" }), row({ id: "y" })], 12);
    expect(t.value).toBeNull();
    expect(t.equity).toBeNull();
    expect(t.appreciationPct).toBeNull();
  });

  it("computes appreciation only over units carrying both value and price", () => {
    const t = buildingTotals(
      [
        row({ id: "p", currentValue: 110_000, purchasePrice: 100_000 }),
        row({ id: "q", currentValue: 500_000, purchasePrice: null }),
      ],
      12
    );
    expect(t.appreciationPct).toBeCloseTo(0.1);
    expect(t.value).toBe(610_000);
  });
});

describe("sortEntries", () => {
  const entries = groupByBuilding(
    [
      row({ id: "a", title: "B street", net: 500 }),
      row({ id: "d1", title: "A street #1", buildingKey: "d", net: 100 }),
      row({ id: "d2", title: "A street #2", buildingKey: "d", net: 300 }),
      row({ id: "c", title: "C street", net: -50, currentValue: 1 }),
    ],
    12
  );

  it("sorts buildings by their totals and units within by the same key", () => {
    const desc = sortEntries(entries, "net", "desc");
    expect(desc.map((e) => e.key)).toEqual(["bk-a", "d", "bk-c"]);
    const b = desc[1];
    if (b.kind !== "building") throw new Error("expected building");
    expect(b.units.map((u) => u.id)).toEqual(["d2", "d1"]);
  });

  it("puts blanks last in either direction", () => {
    expect(sortEntries(entries, "value", "asc").at(0)?.key).toBe("bk-c");
    expect(sortEntries(entries, "value", "desc").at(0)?.key).toBe("bk-c");
  });

  it("sorts by name", () => {
    expect(sortEntries(entries, "property", "asc").map((e) => e.key)).toEqual(["d", "bk-a", "bk-c"]);
  });
});

describe("portfolioKpis", () => {
  const rows = [
    row({ id: "r1", net: 6_000, currentValue: 300_000, purchasePrice: 250_000, mortgageBalance: 200_000, cashInvested: 50_000, buildingKey: "b1" }),
    row({ id: "r2", net: 2_000, currentValue: 200_000, purchasePrice: 200_000, mortgageBalance: null, cashInvested: 40_000, buildingKey: "dup", currentTenantName: null }),
    row({ id: "r3", net: 1_000, currentValue: null, purchasePrice: 200_000, cashInvested: 40_000, buildingKey: "dup" }),
    row({ id: "r4", net: -500, cashInvested: 0, buildingKey: "b4" }),
    row({ id: "home", usage: "residence", net: 0, currentValue: 900_000, mortgageBalance: 400_000 }),
    row({ id: "old", archived: true, net: 99_999, currentValue: 1_000_000 }),
  ];
  const k = portfolioKpis(rows, 6);

  it("covers active rentals only", () => {
    expect(k.rentals).toBe(4);
    expect(k.net).toBe(8_500);
    expect(k.avgNetPerMonth).toBeCloseTo(8_500 / 6);
    expect(k.leased).toBe(3);
  });

  it("sums value and equity over valued rentals and counts missing mortgages", () => {
    expect(k.value).toBe(500_000);
    expect(k.valuedCount).toBe(2);
    expect(k.equity).toBe(300_000);
    expect(k.missingMortgage).toBe(1);
  });

  it("counts each building's cash once and skips buildings without cash", () => {
    expect(k.cashInvested).toBe(90_000);
    expect(k.cashOnCashPct).toBeCloseTo((9_000 / 90_000) * 100);
  });

  it("reports appreciation and net-if-sold over priced, valued rentals", () => {
    expect(k.appreciationGain).toBe(50_000);
    expect(k.appreciationPct).toBeCloseTo(50_000 / 450_000);
    expect(k.netIfSold).toBeCloseTo(500_000 * 0.92 - 450_000);
  });

  it("reports home equity separately", () => {
    expect(k.homeEquity).toBe(500_000);
  });

  it("handles an empty portfolio", () => {
    const e = portfolioKpis([], 0);
    expect(e.rentals).toBe(0);
    expect(e.avgNetPerMonth).toBeNull();
    expect(e.cashOnCashPct).toBeNull();
    expect(e.appreciationPct).toBeNull();
    expect(e.homeEquity).toBeNull();
  });
});
