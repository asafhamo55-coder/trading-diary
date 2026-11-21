import { describe, expect, it } from "vitest";
import { householdBundleSchema } from "../../src/lib/savings-validators";

describe("householdBundleSchema", () => {
  it("accepts accounts, benefits and profile members without an Israeli doc", () => {
    const r = householdBundleSchema.safeParse({
      accounts: [{ owner: "alex", country: "US", type: "401k", provider: "Acme", currency: "USD", balance: 1000, balanceAsOf: "2026-09-30" }],
      benefits: [{ owner: "alex", country: "US", source: "employer:Acme", category: "life", coverageAmount: 100000, coverageCurrency: "USD" }],
      profile: { members: [{ key: "kid", role: "child", birthDate: "2015-01-01" }] },
    });
    expect(r.success).toBe(true);
  });

  it("rejects an empty bundle", () => {
    expect(householdBundleSchema.safeParse({}).success).toBe(false);
  });
});
