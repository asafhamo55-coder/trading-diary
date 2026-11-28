import { describe, expect, it } from "vitest";

import { matchRentals, scheduleEToTransactions } from "../../src/lib/tax-return-backfill";
import { parseTaxReturn, type ScheduleERental } from "../../src/lib/tax-return-schema";

const rental = (over: Partial<ScheduleERental> & { address: string }): ScheduleERental =>
  parseTaxReturn({ taxYear: 2025, jurisdiction: "US-federal", data: { rentals: [over] } }).data.rentals[0];

const sum = (xs: { amount: number }[]) => Math.round(xs.reduce((s, x) => s + x.amount, 0) * 100) / 100;

describe("scheduleEToTransactions", () => {
  it("maps each non-zero line to one row", () => {
    const r = rental({ address: "1 Test St", lines: { RENT: 15400, REPAIRS: 660, MORTGAGE_INTEREST: 10802, ADVERTISING: 0 } });
    const tx = scheduleEToTransactions(r, 2025, ["p1"]);
    expect(tx).toHaveLength(3);
    const rent = tx.find((t) => t.category === "RENT")!;
    expect(rent.type).toBe("INCOME");
    expect(rent.amount).toBe(15400);
    expect(tx.filter((t) => t.category !== "RENT").every((t) => t.type === "EXPENSE")).toBe(true);
    expect(tx.every((t) => t.date.toISOString().slice(0, 10) === "2025-12-31" && t.month === 12 && t.year === 2025)).toBe(true);
    expect(tx.every((t) => t.source === "taxReturn:2025" && t.description === "2025 Schedule E — from filed return")).toBe(true);
  });

  it("splits a building evenly across units, preserving cents", () => {
    const two = scheduleEToTransactions(rental({ address: "1 Test St", lines: { RENT: 10001 } }), 2025, ["u1", "u2"]);
    expect(two.map((t) => t.amount)).toEqual([5000.5, 5000.5]);
    const three = scheduleEToTransactions(rental({ address: "1 Test St", lines: { REPAIRS: 100 } }), 2025, ["a", "b", "c"]);
    expect(sum(three)).toBe(100);
    expect(three.map((t) => t.propertyId)).toEqual(["a", "b", "c"]);
  });

  it("splits by unit rent when given", () => {
    const tx = scheduleEToTransactions(rental({ address: "1 Test St", lines: { RENT: 30000 } }), 2025, ["u1", "u2"], { u1: 1400, u2: 1100 });
    expect(tx.map((t) => [t.propertyId, t.amount])).toEqual([
      ["u1", 16800],
      ["u2", 13200],
    ]);
  });

  it("negative or null lines create no rows", () => {
    expect(scheduleEToTransactions(rental({ address: "1 Test St", lines: { OTHER: -50, LEGAL: null } }), 2025, ["p1"])).toEqual([]);
  });
});

describe("matchRentals", () => {
  const props = [
    { id: "w", address: "1104 Example Cir NW, Conyers, GA 30012", street: "1104 Example Cir NW", unit: null },
    { id: "l1", address: "1053 Sample Ct NW #1", street: "1053 Sample Ct NW", unit: "1" },
    { id: "l2", address: "1053 Sample Ct NW #2", street: "1053 Sample Ct NW", unit: "2" },
  ];

  it("matches abbreviations and returns every unit of a building", () => {
    const { matched, unmatched } = matchRentals(
      [rental({ address: "1104 EXAMPLE CIRCLE NW" }), rental({ address: "1053 SAMPLE COURT" })],
      props
    );
    expect(matched.map((m) => m.propertyIds)).toEqual([["w"], ["l1", "l2"]]);
    expect(unmatched).toEqual([]);
  });

  it("lists a property the app doesn't have", () => {
    const { matched, unmatched } = matchRentals([rental({ address: "1115 SOLD ROAD NW" })], props);
    expect(matched).toEqual([]);
    expect(unmatched).toEqual(["1115 SOLD ROAD NW"]);
  });

  it("lets an explicit propertyId or unitIds win", () => {
    const { matched } = matchRentals(
      [rental({ address: "somewhere else", propertyId: "w" }), rental({ address: "x", unitIds: ["l2"] })],
      props
    );
    expect(matched.map((m) => m.propertyIds)).toEqual([["w"], ["l2"]]);
  });
});

import { fillTaxBasis } from "../../src/lib/tax-return-backfill";

describe("fillTaxBasis", () => {
  const dep = { basis: 113000, land: 20000, method: "SL 27.5", placedInService: "2023-08-28", prior: 6000, current: 3400 };

  it("fills empty fields from the depreciation report", () => {
    expect(fillTaxBasis(undefined, dep)).toMatchObject({ landValue: 20000, buildingValue: 93000, placedInService: "2023-08-28", method: "SL 27.5" });
  });

  it("never overwrites what the user entered", () => {
    const out = fillTaxBasis({ landValue: 25000, method: "MACRS" } as never, dep);
    expect(out).toMatchObject({ landValue: 25000, method: "MACRS", buildingValue: 93000, placedInService: "2023-08-28" });
  });

  it("returns null when nothing would change", () => {
    expect(fillTaxBasis({ landValue: 1, buildingValue: 2, placedInService: "2020-01-01", method: "x" } as never, dep)).toBeNull();
    expect(fillTaxBasis(undefined, null)).toBeNull();
  });
});
