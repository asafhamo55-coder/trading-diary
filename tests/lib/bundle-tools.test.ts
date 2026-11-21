import { describe, expect, it } from "vitest";
import {
  idsFromAccountNumbers,
  isValidIsraeliId,
  mergeBundles,
  scrubBundle,
  summarizeBundle,
  toBundle,
} from "../../src/lib/bundle-tools";
import { householdBundleSchema } from "../../src/lib/savings-validators";

// All values are synthetic. 000000018 and 123456782 pass the Israeli ID check
// digit; neither belongs to anyone.
const VALID_ID = "123456782";

describe("isValidIsraeliId", () => {
  it("accepts valid check digits and rejects others", () => {
    expect(isValidIsraeliId(VALID_ID)).toBe(true);
    expect(isValidIsraeliId("000000018")).toBe(true);
    expect(isValidIsraeliId("123456789")).toBe(false);
    expect(isValidIsraeliId("12345")).toBe(false);
    expect(isValidIsraeliId("000000000")).toBe(false);
  });
});

describe("scrubBundle", () => {
  it("keeps full policy / account numbers (user-approved)", () => {
    const doc = {
      accounts: [{ owner: "alex", provider: "P", policyNumber: "351977634", details: { accountNumber: "9988776655" } }],
      israel: { people: [{ key: "dana", products: [{ policyNumber: "34534347-2" }] }] },
    };
    const { bundle, findings } = scrubBundle(doc);
    expect(findings).toEqual([]);
    expect(bundle).toEqual(doc);
  });

  it("keeps an ID-based account number but removes the bare ID elsewhere", () => {
    const doc = {
      israel: {
        people: [
          {
            key: "alex",
            products: [{ policyNumber: `${VALID_ID}-2`, notes: `Account is the member's ID ${VALID_ID} plus a suffix; see ${VALID_ID}-2.` }],
          },
        ],
      },
    };
    expect([...idsFromAccountNumbers(doc)]).toEqual([VALID_ID]);
    const { bundle, findings } = scrubBundle(doc);
    const p = bundle.israel.people[0].products[0];
    expect(p.policyNumber).toBe(`${VALID_ID}-2`);
    expect(p.notes).toBe(`Account is the member's ID [ID removed] plus a suffix; see ${VALID_ID}-2.`);
    expect(findings.map((f) => f.kind)).toEqual(["known-id"]);
  });

  it("removes a bare ID even from an account-number field", () => {
    const doc = { x: [{ policyNumber: `${VALID_ID}-3` }, { policyNumber: VALID_ID }] };
    const { bundle } = scrubBundle(doc);
    expect(bundle.x[0].policyNumber).toBe(`${VALID_ID}-3`);
    expect(bundle.x[1].policyNumber).toBe("[ID removed]");
  });

  it("drops personal-ID fields entirely", () => {
    const doc = { israel: { people: [{ key: "alex", nationalId: VALID_ID, idNumber: "012345674", ssn: "123-45-6789", tz: 123456782, products: [] }] } };
    const { bundle, findings } = scrubBundle(doc);
    expect(Object.keys(bundle.israel.people[0]).sort()).toEqual(["key", "products"]);
    expect(findings).toHaveLength(4);
    expect(findings.every((f) => f.kind === "id-field")).toBe(true);
  });

  it("removes SSNs and labelled IDs from free text (Hebrew and English)", () => {
    const doc = {
      notes: [
        "Participant SSN 123-45-6789 on page 1",
        "ת.ז 012345674 מופיע בכותרת",
        'ת"ז: 000000018',
        "National ID no. 123456782",
      ],
    };
    const { bundle, findings } = scrubBundle(doc);
    expect(bundle.notes).toEqual([
      "Participant SSN [SSN removed] on page 1",
      "ת.ז [ID removed] מופיע בכותרת",
      'ת"ז: [ID removed]',
      "National ID no. [ID removed]",
    ]);
    expect(findings.map((f) => f.kind)).toEqual(["ssn", "national-id", "national-id", "national-id"]);
  });

  it("leaves amounts, dates and unlabelled numbers alone", () => {
    const doc = { notes: "Balance 1,039,908 as of 2026-09-30; policy 351977634; fund code 9647; phone 03-1234567; 100603.54" };
    const { bundle, findings } = scrubBundle(doc);
    expect(findings).toEqual([]);
    expect(bundle).toEqual(doc);
  });

  it("does not mutate its input", () => {
    const doc = { notes: "SSN 123-45-6789" };
    scrubBundle(doc);
    expect(doc.notes).toBe("SSN 123-45-6789");
  });
});

const ilDoc = (asOf: string, balance: number) => ({
  asOf: { alex: asOf },
  currency: "ILS",
  people: [
    {
      key: "alex",
      nameEn: "Test",
      products: [{ type: "pension", provider: "Sample Pension", policyNumber: "PN-1111", balance }],
    },
  ],
});

describe("toBundle", () => {
  it("wraps a bare Israeli extract and passes a bundle through", () => {
    expect(toBundle(ilDoc("2026-06", 1))).toHaveProperty("israel.people");
    expect(toBundle({ accounts: [] })).toEqual({ accounts: [] });
    expect(() => toBundle([])).toThrow();
  });
});

describe("mergeBundles", () => {
  it("combines an Israeli report, a 401(k) and benefits into one valid bundle", () => {
    const { bundle, warnings } = mergeBundles([
      ilDoc("2026-06", 100),
      { accounts: [{ owner: "alex", country: "US", type: "401k", provider: "Sample Recordkeeper", currency: "USD", balance: 5000, balanceAsOf: "2026-09-30" }] },
      {
        benefits: [{ owner: "alex", country: "US", source: "employer:Acme / Carrier", category: "life", coverageAmount: 100000, coverageCurrency: "USD" }],
        profile: { members: [{ key: "yoav", role: "child", birthDate: "2010-01-01" }] },
      },
    ]);
    expect(warnings).toEqual([]);
    expect(householdBundleSchema.safeParse(bundle).success).toBe(true);
    expect(Object.keys(bundle).sort()).toEqual(["accounts", "benefits", "israel", "profile"]);
  });

  it("dedupes the same Israeli product, keeping the newer statement and the latest asOf", () => {
    const { bundle, warnings } = mergeBundles([ilDoc("2026-09", 200), ilDoc("2026-06", 100)]);
    const isr = bundle.israel as { asOf: Record<string, string>; people: { products: { balance: number }[] }[] };
    expect(isr.asOf.alex).toBe("2026-09");
    expect(isr.people).toHaveLength(1);
    expect(isr.people[0].products).toHaveLength(1);
    expect(isr.people[0].products[0].balance).toBe(200);
    expect(isr.people[0].products[0]).not.toHaveProperty("__date");
    expect(warnings).toHaveLength(1);
  });

  it("silently collapses identical rows (same file loaded twice)", () => {
    const b = { accounts: [{ owner: "alex", country: "US", type: "401k", provider: "R", currency: "USD", balance: 1, balanceAsOf: "2026-09-30" }] };
    const { bundle, warnings } = mergeBundles([ilDoc("2026-06", 1), b, ilDoc("2026-06", 1), b]);
    expect(warnings).toEqual([]);
    expect(bundle.accounts).toHaveLength(1);
  });

  it("keeps different people and different products side by side", () => {
    const other = { asOf: { dana: "2026-09-30" }, people: [{ key: "dana", products: [{ type: "hishtalmut", provider: "Fund", balance: 1 }] }] };
    const { bundle } = mergeBundles([ilDoc("2026-06", 1), other]);
    const isr = bundle.israel as { asOf: Record<string, string>; people: { key: string }[] };
    expect(isr.people.map((p) => p.key)).toEqual(["alex", "dana"]);
    expect(isr.asOf).toEqual({ alex: "2026-06", dana: "2026-09-30" });
  });

  it("keeps the newer account balance and warns on colliding benefits", () => {
    const acc = (balance: number, balanceAsOf: string) => ({ owner: "alex", country: "US", type: "401k", provider: "R", currency: "USD", balance, balanceAsOf });
    const ben = (monthlyCost: number) => ({ owner: "alex", country: "US", source: "employer:Acme", category: "add", monthlyCost });
    const { bundle, warnings } = mergeBundles([
      { accounts: [acc(2, "2026-09-30")], benefits: [ben(1)] },
      { accounts: [acc(1, "2026-06-30")], benefits: [ben(2)] },
    ]);
    expect((bundle.accounts as { balance: number }[]).map((a) => a.balance)).toEqual([2]);
    expect((bundle.benefits as { monthlyCost: number }[]).map((b) => b.monthlyCost)).toEqual([2]);
    expect(warnings).toHaveLength(2);
  });

  it("merges profile members by key, later non-null values winning", () => {
    const { bundle } = mergeBundles([
      { profile: { members: [{ key: "alex", role: "adult", name: "Alex", employment: null }] } },
      { profile: { members: [{ key: "alex", role: "adult", name: null, employment: "Acme" }], riskTolerance: "medium" } },
    ]);
    expect(bundle.profile).toEqual({ riskTolerance: "medium", members: [{ key: "alex", role: "adult", name: "Alex", employment: "Acme" }] });
  });
});

describe("summarizeBundle", () => {
  it("totals balances per owner and currency and flags soft problems", () => {
    const s = summarizeBundle({
      israel: ilDoc("2026-06", 1000),
      accounts: [{ owner: "stranger", country: "US", type: "401k", provider: "R", currency: "USD", balance: 50 }],
      benefits: [
        { owner: "alex", source: "S", category: "add" },
        { owner: "alex", source: "S", category: "add" },
      ],
      documentType: "us_401k",
    });
    expect(s.totalsByOwner).toEqual({ alex: { ILS: 1000 }, stranger: { USD: 50 } });
    expect(s.israeliProducts).toBe(1);
    const w = s.warnings.join("\n");
    expect(w).toContain('owner "stranger"');
    expect(w).toContain("no balanceAsOf");
    expect(w).toContain("appears twice");
    expect(w).toContain('"documentType" is extraction metadata');
  });
});

describe("synthetic extraction results conform to the import schema", () => {
  it("accepts one synthetic bundle per supported document type", async () => {
    const examples = await import("../../.claude/skills/import-statements/examples.json");
    for (const [name, b] of Object.entries(examples.default as Record<string, unknown>)) {
      const r = householdBundleSchema.safeParse(b);
      expect(r.success, `${name}: ${r.success ? "" : r.error.message}`).toBe(true);
      expect(scrubBundle(b).findings, name).toEqual([]);
    }
  });
});
