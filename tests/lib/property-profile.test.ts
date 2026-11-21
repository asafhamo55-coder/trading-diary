import { describe, expect, it } from "vitest";

import {
  EMPTY_RECORD,
  addMonths,
  amortizedPayment,
  depreciationSummary,
  documentInputSchema,
  insuranceSchema,
  keyDatesOf,
  loanDerived,
  loanInputSchema,
  monthsBetween,
  nextMonthlyDate,
  parseProfile,
  sectionFilled,
  summarizeRecord,
  syncedMortgage,
  type PropertyLoanDTO,
  type PropertyRecord,
} from "../../src/lib/property-profile";
import { attentionItems, keyDateItem } from "../../src/lib/property-attention";
import { row } from "./property-row-fixture";

const TODAY = "2026-11-21";

function loan(over: Partial<PropertyLoanDTO> = {}): PropertyLoanDTO {
  return { id: "l", ...loanInputSchema.parse({}), ...over };
}

describe("date math", () => {
  it("counts whole months and adds months with the day clamped", () => {
    expect(monthsBetween("2022-07-01", "2026-11-21")).toBe(52);
    expect(monthsBetween("2026-01-31", "2026-02-28")).toBe(0);
    expect(monthsBetween("2026-12-01", "2026-11-01")).toBe(0);
    expect(addMonths("2022-07-01", 360)).toBe("2052-07-01");
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
  });

  it("finds the next monthly due date", () => {
    expect(nextMonthlyDate(25, TODAY)).toBe("2026-11-25");
    expect(nextMonthlyDate(1, TODAY)).toBe("2026-12-01");
    expect(nextMonthlyDate(31, "2026-02-10")).toBe("2026-02-28");
    expect(nextMonthlyDate(5, "2026-12-20")).toBe("2027-01-05");
  });
});

describe("schemas", () => {
  it("turns blanks into nulls and rejects a non-http link", () => {
    const ok = insuranceSchema.parse({ carrier: "  ", annualPremium: 1200, portalUrl: "" });
    expect(ok.carrier).toBeNull();
    expect(ok.portalUrl).toBeNull();
    expect(ok.annualPremium).toBe(1200);
    expect(insuranceSchema.safeParse({ portalUrl: "javascript:alert(1)" }).success).toBe(false);
    expect(insuranceSchema.safeParse({ renewalDate: "12/28/2026" }).success).toBe(false);
    expect(documentInputSchema.safeParse({ title: "Deed", url: "ftp://x" }).success).toBe(false);
  });

  it("accepts the loan form's payload (blank strings and nulls)", () => {
    const payload = {"kind":"first","lender":"Example Bank","servicer":"","loanNumber":"","portalUrl":"","servicerPhone":"","originalAmount":null,"startDate":"","termMonths":null,"interestRate":6.5,"rateType":"fixed","armResetDate":"","armIndex":"","armMargin":null,"monthlyPI":null,"escrowMonthly":null,"pmiMonthly":null,"pmiRemovalDate":"","maturityDate":"","balance":150000,"balanceAsOf":"","active":true,"notes":""};
    const parsed = loanInputSchema.parse(payload);
    expect(parsed).toMatchObject({ lender: "Example Bank", startDate: null, portalUrl: null, balance: 150000, interestRate: 6.5 });
  });

  it("parses each profile section on its own, dropping only the bad one", () => {
    const p = parseProfile({ facts: { beds: 3 }, insurance: { renewalDate: "not a date" }, junk: 1 });
    expect(p.facts?.beds).toBe(3);
    expect(p.insurance).toBeUndefined();
    expect(parseProfile(null)).toEqual({});
  });

  it("knows when a section has anything in it", () => {
    expect(sectionFilled(undefined)).toBe(false);
    expect(sectionFilled({ a: null, b: "" })).toBe(false);
    expect(sectionFilled({ a: null, b: [] })).toBe(false);
    expect(sectionFilled({ a: 0 })).toBe(true);
  });
});

describe("loanDerived", () => {
  it("derives maturity, remaining term, payment and interest YTD from the schedule", () => {
    const l = loan({ originalAmount: 200_000, startDate: "2024-01-01", termMonths: 360, interestRate: 6, escrowMonthly: 400, pmiMonthly: 50 });
    const d = loanDerived(l, TODAY);
    expect(d.maturityDate).toBe("2054-01-01");
    expect(d.remainingMonths).toBe(325);
    // P&I not recorded: escrow + PMI only.
    expect(d.totalMonthlyPayment).toBe(450);
    // Months 24–33 of the schedule (Jan–Oct 2026 payments): ~ $963/month of interest.
    expect(d.interestYtd!).toBeGreaterThan(9_400);
    expect(d.interestYtd!).toBeLessThan(9_800);
  });

  it("falls back to rate × balance, and to nothing without a rate", () => {
    expect(loanDerived(loan({ interestRate: 6, balance: 120_000 }), TODAY).interestYtd).toBeCloseTo(600 * 11);
    const none = loanDerived(loan({ balance: 120_000 }), TODAY);
    expect(none.interestYtd).toBeNull();
    expect(none.maturityDate).toBeNull();
    expect(none.remainingMonths).toBeNull();
    expect(none.totalMonthlyPayment).toBeNull();
  });

  it("uses a recorded maturity and stops at zero once it has passed", () => {
    expect(loanDerived(loan({ maturityDate: "2020-01-01" }), TODAY).remainingMonths).toBe(0);
  });

  it("matches the standard amortization formula", () => {
    expect(amortizedPayment(200_000, 6, 360)).toBeCloseTo(1199.1, 1);
    expect(amortizedPayment(12_000, 0, 12)).toBe(1000);
  });
});

describe("syncedMortgage", () => {
  it("sums active balances as of the latest date, and leaves the figure alone otherwise", () => {
    expect(
      syncedMortgage([
        { active: true, balance: 150_000, balanceAsOf: "2026-10-01" },
        { active: true, balance: 10_000, balanceAsOf: "2026-11-01" },
        { active: false, balance: 99_999, balanceAsOf: "2026-12-01" },
        { active: true, balance: null, balanceAsOf: null },
      ])
    ).toEqual({ balance: 160_000, asOf: "2026-11-01" });
    expect(syncedMortgage([])).toBeNull();
    expect(syncedMortgage([{ active: false, balance: 5, balanceAsOf: null }])).toBeNull();
  });
});

describe("depreciationSummary", () => {
  it("splits closing costs by the land/building ratio and adds improvements, not repairs", () => {
    const s = depreciationSummary(
      { closingCosts: 10_000, landValue: 50_000, buildingValue: 150_000, allocationSource: null, placedInService: null, method: null, costSegStudy: null, costSegNotes: null },
      [
        { amount: 20_000, category: "improvement" },
        { amount: 500, category: "repair" },
      ]
    );
    expect(s.depreciableBasis).toBe(150_000 + 7_500 + 20_000);
    expect(s.annualDepreciation).toBeCloseTo(177_500 / 27.5);
    expect(s.improvementsTotal).toBe(20_000);
    expect(s.repairsTotal).toBe(500);
  });

  it("needs a building value", () => {
    expect(depreciationSummary(undefined, []).depreciableBasis).toBeNull();
  });
});

const RECORD: PropertyRecord = {
  ...EMPTY_RECORD,
  profile: parseProfile({
    insurance: { carrier: "Example Mutual", renewalDate: "2026-12-28", annualPremium: 1800 },
    tax: { county: "Sample", dueDates: ["2026-04-10", "2026-12-10"], annualTax: 3000, nextAppealDeadline: "2027-05-01" },
    hoa: { name: "Sample HOA", monthlyDues: 250, dueDay: 1 },
    systems: { items: [{ kind: "hvac", warrantyEnd: "2027-01-05" }] },
  }),
  loans: [
    loan({ id: "a", kind: "first", lender: "Example Bank", balance: 150_000, interestRate: 5, monthlyPI: 900, escrowMonthly: 300, pmiMonthly: 60, pmiRemovalDate: "2026-12-01" }),
    loan({ id: "b", kind: "heloc", balance: 50_000, interestRate: 9, rateType: "arm", armResetDate: "2027-01-01", monthlyPI: 400 }),
    loan({ id: "c", active: false, balance: 1, rateType: "arm", armResetDate: "2026-12-01" }),
  ],
};

describe("keyDatesOf", () => {
  it("collects every dated item from the record, skipping inactive loans", () => {
    const kinds = keyDatesOf(RECORD.profile, RECORD.loans, TODAY).map((k) => `${k.kind}@${k.date}`);
    expect(kinds).toEqual([
      "insurance-renewal@2026-12-28",
      "tax-due@2026-04-10",
      "tax-due@2026-12-10",
      "appeal-deadline@2027-05-01",
      "hoa-dues@2026-12-01",
      "warranty-end@2027-01-05",
      "pmi-removal@2026-12-01",
      "arm-reset@2027-01-01",
    ]);
  });
});

describe("keyDateItem (60-day lookahead)", () => {
  const at = (kind: Parameters<typeof keyDateItem>[0]["kind"], date: string) => keyDateItem({ kind, date, label: "X" }, TODAY);

  it("flags upcoming dates inside 60 days, urgent inside 14", () => {
    expect(at("tax-due", "2026-12-01")?.severity).toBe("danger");
    expect(at("tax-due", "2027-01-15")?.severity).toBe("warning");
    expect(at("tax-due", "2027-01-21")).toBeNull();
    expect(at("tax-due", "2026-04-10")).toBeNull();
    expect(at("arm-reset", "2027-01-01")?.title).toBe("Rate resets in 41 days");
    expect(at("appeal-deadline", "2027-05-01")).toBeNull();
    expect(at("warranty-end", "2027-01-05")?.severity).toBe("info");
  });

  it("asks for the new policy once a renewal date has passed", () => {
    expect(at("insurance-renewal", "2026-10-01")?.title).toBe("Insurance renewal date passed");
    expect(at("insurance-renewal", "2024-10-01")).toBeNull();
  });

  it("keeps PMI removal up once eligible and HOA dues only the week they're due", () => {
    expect(at("pmi-removal", "2026-06-01")?.title).toBe("PMI can be removed");
    expect(at("pmi-removal", "2027-06-01")).toBeNull();
    expect(at("hoa-dues", "2026-11-25")?.title).toBe("HOA dues in 4 days");
    expect(at("hoa-dues", "2026-12-01")).toBeNull();
  });

  it("feeds attentionItems for the property", () => {
    const r = row({ id: "p", net: 100, currentValue: 1, valueAsOf: "2026-11-01", mortgageBalance: 1, leaseEnd: null });
    const items = attentionItems([r], TODAY, new Map([["p", keyDatesOf(RECORD.profile, RECORD.loans, TODAY)]]));
    // Warnings before info; within a tier, the record's order.
    expect(items.map((i) => i.kind)).toEqual([
      "insurance-renewal",
      "tax-due",
      "arm-reset",
      "warranty-end",
      "pmi-removal",
    ]);
    expect(new Set(items.map((i) => i.id)).size).toBe(items.length);
  });
});

describe("summarizeRecord", () => {
  it("rolls up active loans and the single-value sections for the advisor", () => {
    const s = summarizeRecord(RECORD, TODAY);
    expect(s.loans.count).toBe(2);
    expect(s.loans.totalBalance).toBe(200_000);
    expect(s.loans.weightedRatePct).toBeCloseTo((150_000 * 5 + 50_000 * 9) / 200_000);
    expect(s.loans.monthlyPI).toBe(1300);
    expect(s.loans.totalMonthlyPayment).toBe(1660);
    expect(s.loans.hasArm).toBe(true);
    expect(s.loans.nextArmReset).toBe("2027-01-01");
    expect(s.loans.hasPmi).toBe(true);
    expect(s.insurance).toMatchObject({ carrier: "Example Mutual", annualPremium: 1800 });
    expect(s.tax).toMatchObject({ annualTax: 3000, nextDueDate: "2026-12-10" });
    expect(s.management).toBeNull();
    expect(s.hoaMonthlyDues).toBe(250);
    expect(s.keyDates[0].date <= s.keyDates.at(-1)!.date).toBe(true);
  });

  it("handles an empty record", () => {
    const s = summarizeRecord(EMPTY_RECORD, TODAY);
    expect(s.loans.count).toBe(0);
    expect(s.loans.totalBalance).toBeNull();
    expect(s.insurance).toBeNull();
    expect(s.depreciation.depreciableBasis).toBeNull();
    expect(s.keyDates).toEqual([]);
  });
});

describe("blank select values", () => {
  it("treats an unselected dropdown (\"\") as not set instead of failing", async () => {
    const { managementSchema, loanInputSchema } = await import("../../src/lib/property-profile");
    const m = managementSchema.safeParse({ mode: "", feeType: "", company: "Acme PM" });
    expect(m.success).toBe(true);
    expect(m.success && m.data.feeType).toBe(null);
    const l = loanInputSchema.safeParse({ kind: "", rateType: "" });
    expect(l.success && l.data.rateType).toBe("fixed");
  });
});
