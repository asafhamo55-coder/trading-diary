import { describe, expect, it } from "vitest";
import { buildRealEstateReview, vacancyMonths, yearFinancials, type PropertyWithTx } from "../../src/lib/advisor-properties";
import type { PropertyTransactionDTO, TenantDTO } from "../../src/lib/property";

// Synthetic properties only (public repo).
let n = 0;
const tx = (year: number, month: number, type: "INCOME" | "EXPENSE", category: string, amount: number, taxOnly = false): PropertyTransactionDTO => ({
  id: `t${++n}`,
  propertyId: "p1",
  date: `${year}-${String(month).padStart(2, "0")}-01`,
  year,
  month,
  type,
  category,
  amount,
  description: null,
  taxOnly,
});
const tenant = (leaseStart: string, leaseEnd: string | null, monthlyRent: number | null): TenantDTO => ({
  id: `ten-${leaseStart}`,
  propertyId: "p1",
  name: "Tenant",
  email: null,
  phone: null,
  leaseStart,
  leaseEnd,
  monthlyRent,
  securityDeposit: null,
  notes: null,
});

function property(over: Partial<PropertyWithTx> = {}): PropertyWithTx {
  return {
    id: "p1",
    nickname: "",
    address: "100 Example St #1, Springfield, ST 00000",
    street: "100 Example St",
    unit: "1",
    city: "Springfield",
    state: "ST",
    zip: "00000",
    purchasePrice: 600_000,
    downPayment: 150_000,
    purchaseDate: "2020-06-01",
    currentValue: 800_000,
    valueAsOf: "2026-10-01",
    mortgageBalance: 400_000,
    mortgageAsOf: "2026-10-01",
    usage: "rental",
    notes: null,
    archivedAt: null,
    transactions: [],
    tenants: [],
    ...over,
  };
}

describe("vacancyMonths", () => {
  it("counts months with no lease covering them; null without lease history", () => {
    expect(vacancyMonths([], 2025, 12)).toBeNull();
    expect(vacancyMonths([tenant("2025-03-15", "2025-10-31", 4000)], 2025, 12)).toBe(4); // Jan, Feb, Nov, Dec
    expect(vacancyMonths([tenant("2024-01-01", null, 4000)], 2025, 12)).toBe(0);
  });
});

describe("yearFinancials", () => {
  it("splits income/expenses by category and derives NOI, expense ratio and cost shares", () => {
    const txs = [
      tx(2025, 1, "INCOME", "RENT", 48_000),
      tx(2025, 2, "EXPENSE", "PROPERTY_TAX", 6_000),
      tx(2025, 3, "EXPENSE", "INSURANCE", 2_400),
      tx(2025, 4, "EXPENSE", "REPAIRS", 1_800),
      tx(2025, 4, "EXPENSE", "CLEANING_MAINT", 600),
      tx(2025, 5, "EXPENSE", "MANAGEMENT", 3_840),
      tx(2025, 6, "EXPENSE", "MORTGAGE_INTEREST", 16_000),
      tx(2025, 12, "EXPENSE", "DEPRECIATION", 17_000, true),
      tx(2024, 1, "INCOME", "RENT", 1),
    ];
    const y = yearFinancials(txs, [], 2025, 12);
    expect(y.rentIncome).toBe(48_000);
    expect(y.operatingExpenses).toBe(14_640);
    expect(y.noi).toBe(33_360);
    expect(y.mortgageInterest).toBe(16_000);
    expect(y.cashFlowBeforePrincipal).toBe(17_360);
    expect(y.depreciation).toBe(17_000); // read even though tax-only
    expect(y.expensesByCategory.DEPRECIATION).toBeUndefined(); // tax-only excluded from performance
    expect(y.expenseRatioPct).toBe(30.5);
    expect(y.shareOfRentPct).toEqual({ propertyTax: 12.5, insurance: 5, repairs: 5, management: 8 });
  });
});

describe("buildRealEstateReview", () => {
  const asOf = new Date("2026-11-21T00:00:00Z");

  it("builds metrics from last year, current lease and tax facts; groups units by building", () => {
    const p1 = property({
      transactions: [tx(2025, 1, "INCOME", "RENT", 48_000), tx(2025, 2, "EXPENSE", "PROPERTY_TAX", 8_000), tx(2025, 3, "EXPENSE", "MORTGAGE_INTEREST", 16_000)],
      tenants: [tenant("2025-01-01", "2027-02-28", 4_200)],
    });
    const p2 = property({ id: "p2", unit: "2", address: "100 Example St #2, Springfield, ST 00000" });
    const home = property({ id: "h1", usage: "residence", currentValue: 1_000_000, mortgageBalance: 300_000 });
    const r = buildRealEstateReview([p1, p2, home], asOf);

    expect(r.rentals.map((x) => x.id)).toEqual(["p1", "p2"]);
    const a = r.rentals[0];
    expect(a.unitsInBuilding).toBe(2);
    expect(a.currentRentMonthly).toBe(4_200);
    expect(a.lease).toMatchObject({ start: "2025-01-01", end: "2027-02-28", monthsToEnd: 3 });
    expect(a.metrics).toEqual({
      basis: "lastYear",
      noiAnnual: 40_000,
      capRateOnValuePct: 5,
      cashOnCashPct: 16, // (40,000 − 16,000) / 150,000
      expenseRatioPct: 16.7,
      rentToValueMonthlyPct: 0.5, // below the 1% rule
    });
    expect(a.equity).toBe(400_000);
    expect(a.tax).toMatchObject({ depreciationStartYear: 2020, yearsHeld: 6, costSegregationCandidate: true, landVsBuildingKnown: false, depreciationRecordedLastYear: false });
    expect(a.dataGaps).toContain("Land vs building split unknown (drives the depreciation basis).");
    expect(a.record).toBeNull();

    expect(r.rentals[1].metrics.basis).toBe("none");
    expect(r.rentals[1].dataGaps).toContain("No current tenant/lease recorded.");
    expect(r.residence).toEqual([{ id: "h1", title: "100 Example St", currentValue: 1_000_000, valueAsOf: "2026-10-01", mortgageBalance: 300_000, equity: 700_000 }]);
    expect(r.questions.length).toBeGreaterThan(0);
  });

  it("annualizes this year when last year is empty, and passes through full records", () => {
    const p = property({ transactions: [tx(2026, 1, "INCOME", "RENT", 11_000), tx(2026, 2, "EXPENSE", "INSURANCE", 1_100)] });
    const r = buildRealEstateReview([p], asOf, { p1: { basis: { landValue: 200_000 }, insurance: { annualPremium: 2_000 } } });
    expect(r.rentals[0].metrics.basis).toBe("thisYearAnnualized");
    expect(r.rentals[0].metrics.noiAnnual).toBe(10_800); // 9,900 × 12 / 11
    expect(r.rentals[0].tax.landValue).toBe(200_000);
    expect(r.rentals[0].tax.landVsBuildingKnown).toBe(true);
    expect(r.rentals[0].record?.insurance?.annualPremium).toBe(2_000);
  });

  it("skips archived properties", () => {
    expect(buildRealEstateReview([property({ archivedAt: "2026-01-01" })], asOf).rentals).toEqual([]);
  });
});
