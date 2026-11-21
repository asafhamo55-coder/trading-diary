import { describe, expect, it } from "vitest";
import fixture from "../fixtures/savings-import.sample.json";
import { savingsImportSchema } from "../../src/lib/savings-validators";
import {
  coverageCategory,
  mapSavingsImport,
  normalizeImportType,
} from "../../src/lib/savings-import";

function mapped() {
  const parsed = savingsImportSchema.safeParse(fixture);
  if (!parsed.success) throw new Error(parsed.error.message);
  return mapSavingsImport(parsed.data);
}

describe("savingsImportSchema", () => {
  it("accepts the extractor shape and coerces numeric strings", () => {
    const parsed = savingsImportSchema.parse(fixture);
    const p = parsed.people[0].products[0];
    expect(p.balance).toBe(250000);
    expect(p.feeDepositPct).toBe(1.5);
  });

  it("rejects a doc with no people", () => {
    expect(savingsImportSchema.safeParse({ asOf: {}, people: [] }).success).toBe(false);
  });
});

describe("mapSavingsImport", () => {
  it("creates one account per savings product and skips standalone term life", () => {
    const m = mapped();
    expect(m.accounts.map((a) => `${a.owner}:${a.type}`)).toEqual([
      "adult_a:pension",
      "adult_a:hishtalmut",
      "adult_b:managers_insurance",
      "adult_b:other",
    ]);
  });

  it("keeps the full policy number and derives the last-4 match key", () => {
    const m = mapped();
    expect(m.accounts[0].policyLast4).toBe("6789");
    expect(m.accounts[0].policyNumber).toBe("PN-0001-2345-6789");
    expect(m.accounts[2].policyLast4).toBe("0000");
  });

  it("maps balances, fees, deposits and the per-person statement date (month end)", () => {
    const [pension] = mapped().accounts;
    expect(pension.balance).toBe(250000);
    expect(pension.currency).toBe("ILS");
    expect(pension.feeDepositPct).toBe(1.5);
    expect(pension.feeAccumulationPct).toBe(0.25);
    expect(pension.monthlyDepositEmployee).toBe(900);
    expect(pension.monthlyDepositTotal).toBe(3125);
    expect(pension.balanceAsOf?.toISOString().slice(0, 10)).toBe("2026-06-30");
    expect(mapped().accounts[2].balanceAsOf?.toISOString().slice(0, 10)).toBe("2026-05-31");
  });

  it("keeps unmapped fields in details", () => {
    const [pension] = mapped().accounts;
    expect(pension.details.conversionFactor).toBe(195);
    expect(pension.details.openDate).toBe("01/03/2010");
    expect(pension.details.sourcePage).toBe(3);
    expect(pension.details).not.toHaveProperty("policyNumber");
  });

  it("writes coverages as linked benefits and term life as a standalone benefit", () => {
    const m = mapped();
    const linked = m.benefits.filter((b) => b.accountMatchKey);
    expect(linked.map((b) => b.category)).toEqual(["life", "work_capacity"]);
    expect(linked.every((b) => b.accountMatchKey === m.accounts[0].matchKey)).toBe(true);
    const standalone = m.benefits.filter((b) => !b.accountMatchKey);
    expect(standalone).toHaveLength(1);
    expect(standalone[0]).toMatchObject({ owner: "adult_a", category: "life", coverageAmount: 1000000, monthlyCost: 120 });
  });

  it("has stable, unique import keys (idempotent re-import)", () => {
    const a = mapped();
    const b = mapped();
    expect(a.benefits.map((x) => x.importKey)).toEqual(b.benefits.map((x) => x.importKey));
    expect(new Set(a.accounts.map((x) => x.matchKey)).size).toBe(a.accounts.length);
    expect(new Set(a.benefits.map((x) => x.importKey)).size).toBe(a.benefits.length);
  });

  it("returns members for the profile merge and warns on unknown types", () => {
    const m = mapped();
    expect(m.members[0]).toMatchObject({ key: "adult_a", name: "Test A", birthDate: "1980-01-15", targetRetirementAge: 67 });
    expect(m.warnings.some((w) => w.includes("crypto_wallet"))).toBe(true);
  });
});

describe("type helpers", () => {
  it("normalizes product types", () => {
    expect(normalizeImportType("Managers-Insurance")).toBe("managers_insurance");
    expect(normalizeImportType("study_fund")).toBe("hishtalmut");
    expect(normalizeImportType("whatever")).toBe("other");
  });

  it("maps Hebrew and English coverage names to categories", () => {
    expect(coverageCategory("disability", null)).toBe("work_capacity");
    expect(coverageCategory(null, "אובדן כושר עבודה")).toBe("work_capacity");
    expect(coverageCategory(null, "מוות מתאונה")).toBe("add");
    expect(coverageCategory(null, "פנסיית שארים")).toBe("life");
    expect(coverageCategory(null, "סיעוד")).toBe("long_term_care");
    expect(coverageCategory("critical illness", null)).toBe("critical_illness");
    expect(coverageCategory("misc", null)).toBe("other");
  });
});
