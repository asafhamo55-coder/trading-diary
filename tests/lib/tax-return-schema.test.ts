import { describe, expect, it } from "vitest";

import { TaxReturnError, findPii, parseTaxReturn } from "../../src/lib/tax-return-schema";

const minimal = { taxYear: 2025, jurisdiction: "US-federal", data: { summary: { agi: 100000 } } };

describe("parseTaxReturn", () => {
  it("accepts a minimal federal return", () => {
    const r = parseTaxReturn(minimal);
    expect(r.taxYear).toBe(2025);
    expect(r.partial).toBe(false);
    expect(r.amended).toBe(false);
    expect(r.data.summary?.agi).toBe(100000);
    expect(r.data.summary?.wages).toBeNull();
    expect(r.data.rentals).toEqual([]);
    expect(r.data.notes).toEqual([]);
    expect(r.data.state).toBeNull();
  });

  it("rejects an unknown jurisdiction", () => {
    expect(() => parseTaxReturn({ ...minimal, jurisdiction: "US-AL" })).toThrow(TaxReturnError);
  });

  it("rejects an SSN anywhere", () => {
    const raw = { ...minimal, data: { ...minimal.data, notes: ["see 123-45-6789"] } };
    expect(() => parseTaxReturn(raw)).toThrow(/data\.notes\.0/);
  });

  it("rejects an SSN printed with spaces", () => {
    const raw = { ...minimal, data: { ...minimal.data, notes: ["id 987 65 4321"] } };
    expect(() => parseTaxReturn(raw)).toThrow(/data\.notes\.0/);
  });

  it("rejects EIN and long digit strings in text", () => {
    const ein = { ...minimal, data: { rentals: [{ address: "Payer 12-3456789" }] } };
    const acct = { ...minimal, data: { rentals: [{ address: "Acct 123456789012" }] } };
    expect(() => parseTaxReturn(ein)).toThrow(/data\.rentals\.0\.address/);
    expect(() => parseTaxReturn(acct)).toThrow(/data\.rentals\.0\.address/);
  });

  it("rejects separated account numbers and IBANs", () => {
    for (const v of ["acct 12-345-678901", "IL62 0108 0000 0009 9999 999", "card 4111 1111 1111 1111"]) {
      expect(() => parseTaxReturn({ ...minimal, data: { notes: [v] } })).toThrow(/data\.notes\.0/);
    }
    expect(parseTaxReturn({ ...minimal, data: { notes: ["placed in service 2025-08-01, 244 days"] } }).data.notes).toHaveLength(1);
  });

  it("allows numbers in numeric fields and short digits in addresses", () => {
    const r = parseTaxReturn({ ...minimal, data: { rentals: [{ address: "1104 Example Cir", lines: { RENT: 15400 } }] } });
    expect(r.data.rentals[0].lines.RENT).toBe(15400);
    expect(r.data.rentals[0].propertyId).toBeNull();
  });

  it("rejects a dateOfBirth-like key", () => {
    for (const key of ["dateOfBirth", "dob", "ssn", "routingNumber", "accountNumber"]) {
      expect(findPii({ data: { [key]: "x" } })).toEqual([`data.${key}`]);
    }
  });
});
