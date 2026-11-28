import { describe, expect, it } from "vitest";

import { compactTaxReturns, reconcileRentals } from "../../src/lib/tax-return-advisor";
import { parseTaxReturn } from "../../src/lib/tax-return-schema";
import type { TaxReturnDTO } from "../../src/lib/tax-return-data";

const ret = (taxYear: number, rentals: unknown[] = [], jurisdiction = "US-federal", partial = false): TaxReturnDTO => ({
  ...parseTaxReturn({ taxYear, jurisdiction, partial, data: { summary: { agi: taxYear }, rentals } }),
  id: `r${taxYear}${jurisdiction}`,
  updatedAt: "2026-11-27T00:00:00.000Z",
});

type Tx = { year: number; month: number; type: "INCOME" | "EXPENSE"; category: string; amount: number; source?: string | null };
const prop = (id: string, transactions: Tx[]) => ({ id, transactions }) as never;
const monthly = (category: string, type: "INCOME" | "EXPENSE", amount: number, months: number, source: string | null = null): Tx[] =>
  Array.from({ length: months }, (_, i) => ({ year: 2026, month: i + 1, type, category, amount, source }));

describe("compactTaxReturns", () => {
  it("keeps the latest two years, newest first", () => {
    const out = compactTaxReturns([ret(2023), ret(2025), ret(2024), ret(2025, [], "US-GA")]);
    expect(out.map((r) => [r.taxYear, r.jurisdiction])).toEqual([
      [2025, "US-federal"],
      [2025, "US-GA"],
      [2024, "US-federal"],
    ]);
  });
});

describe("reconcileRentals", () => {
  const declared = ret(2025, [{ address: "1 Test St", propertyId: "p1", lines: { RENT: 12000, MORTGAGE_INTEREST: 20000, DEPRECIATION: 3000 } }]);

  it("annualizes current-year books", () => {
    const books = [prop("p1", [...monthly("RENT", "INCOME", 1000, 6), ...monthly("MORTGAGE_INTEREST", "EXPENSE", 750, 6)])];
    const [r] = reconcileRentals([declared], books, "2026-06-30");
    expect(r.declaredYear).toBe(2025);
    expect(r.booksRunRate.months).toBe(6);
    expect(r.booksRunRate.rent).toBe(12000);
    expect(r.booksRunRate.interest).toBe(9000);
    expect(r.diffs.map((d) => d.field)).toContain("interest");
    expect(r.diffs.map((d) => d.field)).not.toContain("rent");
  });

  it("ignores taxReturn-sourced rows", () => {
    const books = [prop("p1", [...monthly("RENT", "INCOME", 1000, 6), { year: 2026, month: 12, type: "INCOME", category: "RENT", amount: 99999, source: "taxReturn:2026" }])];
    const [r] = reconcileRentals([declared], books, "2026-06-30");
    expect(r.booksRunRate.rent).toBe(12000);
  });

  it("skips properties without a declared rental", () => {
    expect(reconcileRentals([declared], [prop("other", monthly("RENT", "INCOME", 1000, 6))], "2026-06-30")).toEqual([]);
  });
});
