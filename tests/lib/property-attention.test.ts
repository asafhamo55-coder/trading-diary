import { describe, expect, it } from "vitest";

import { attentionItems, daysBetween, formatShortDate } from "../../src/lib/property-attention";
import type { PropertyRow } from "../../src/lib/property-portfolio";
import { row } from "./property-row-fixture";

const TODAY = "2026-11-21";

// A rental with nothing to flag.
function healthy(over: Partial<PropertyRow> & Pick<PropertyRow, "id">): PropertyRow {
  return row({
    net: 1_000,
    currentValue: 300_000,
    valueAsOf: "2026-10-01",
    mortgageBalance: 100_000,
    downPayment: 60_000,
    cashInvested: 60_000,
    leaseEnd: "2027-08-31",
    ...over,
  });
}

const kinds = (rows: PropertyRow[]) => attentionItems(rows, TODAY).map((i) => `${i.kind}:${i.propertyId}`);

describe("date helpers", () => {
  it("counts whole days across month ends and formats without time zones", () => {
    expect(daysBetween("2026-11-21", "2026-12-21")).toBe(30);
    expect(daysBetween("2026-11-21", "2026-11-01")).toBe(-20);
    expect(formatShortDate("2027-03-03")).toBe("Mar 3, 2027");
  });
});

describe("attentionItems", () => {
  it("returns nothing for a healthy portfolio", () => {
    expect(attentionItems([healthy({ id: "a" })], TODAY)).toEqual([]);
  });

  it("flags a lease that ended with no renewal, with days vacant", () => {
    const [item] = attentionItems(
      [healthy({ id: "v", currentTenantName: null, leaseEnd: null, lastLeaseEnd: "2026-10-07" })],
      TODAY
    );
    expect(item.kind).toBe("lease-expired");
    expect(item.severity).toBe("danger");
    expect(item.title).toBe("Vacant 45 days");
    expect(item.detail).toContain("Oct 7, 2026");
  });

  it("flags a unit with no lease on file, with the time since purchase when known", () => {
    const items = attentionItems(
      [healthy({ id: "n", currentTenantName: null, leaseEnd: null, hasTenants: false, purchaseDate: "2026-11-01" })],
      TODAY
    );
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ kind: "vacant", severity: "warning" });
    expect(items[0].detail).toContain("20 days");
  });

  it("flags leases ending within 60 days, and not ones further out or open-ended", () => {
    expect(kinds([healthy({ id: "soon", leaseEnd: "2026-12-15" })])).toEqual(["lease-ending:soon"]);
    expect(attentionItems([healthy({ id: "soon", leaseEnd: "2026-12-15" })], TODAY)[0].severity).toBe("danger");
    expect(attentionItems([healthy({ id: "mid", leaseEnd: "2027-01-10" })], TODAY)[0].severity).toBe("warning");
    expect(kinds([healthy({ id: "edge", leaseEnd: "2027-01-20" })])).toEqual(["lease-ending:edge"]);
    expect(kinds([healthy({ id: "far", leaseEnd: "2027-01-21" })])).toEqual([]);
    expect(kinds([healthy({ id: "open", leaseEnd: null })])).toEqual([]);
  });

  it("flags negative net only when there are entries", () => {
    expect(kinds([healthy({ id: "neg", net: -1_250 })])).toEqual(["negative-net:neg"]);
    expect(attentionItems([healthy({ id: "neg", net: -1_250 })], TODAY)[0].detail).toBe("Net −$1,250 year to date");
    expect(kinds([healthy({ id: "empty", net: -1, txCount: 0 })])).toEqual([]);
  });

  it("flags a missing value, and a stale or undated one", () => {
    expect(kinds([healthy({ id: "m", currentValue: null, valueAsOf: null })])).toEqual(["missing-value:m"]);
    expect(kinds([healthy({ id: "old", valueAsOf: "2026-05-20" })])).toEqual(["stale-value:old"]);
    expect(kinds([healthy({ id: "ok", valueAsOf: "2026-05-21" })])).toEqual([]);
    expect(kinds([healthy({ id: "nodate", valueAsOf: null })])).toEqual(["stale-value:nodate"]);
  });

  it("flags a missing mortgage balance (but not a recorded $0)", () => {
    expect(kinds([healthy({ id: "mm", mortgageBalance: null })])).toEqual(["missing-mortgage:mm"]);
    expect(kinds([healthy({ id: "free", mortgageBalance: 0 })])).toEqual([]);
  });

  it("flags a missing down payment once per building", () => {
    const items = attentionItems(
      [
        healthy({ id: "u1", buildingKey: "dup", needsDownPayment: true, unitCount: 2, cashInvested: 0 }),
        healthy({ id: "u2", buildingKey: "dup", needsDownPayment: true, unitCount: 2, cashInvested: 0 }),
      ],
      TODAY
    );
    expect(items.map((i) => i.id)).toEqual(["missing-down-payment:u1"]);
    expect(items[0].detail).toContain("2 units");
  });

  it("ignores archived properties and only checks data gaps on the residence", () => {
    expect(kinds([healthy({ id: "gone", archived: true, net: -5, currentValue: null })])).toEqual([]);
    expect(
      kinds([
        healthy({
          id: "home",
          usage: "residence",
          currentTenantName: null,
          net: -9_000,
          mortgageBalance: null,
          needsDownPayment: true,
        }),
      ])
    ).toEqual(["missing-mortgage:home"]);
  });

  it("orders urgent first, then by kind and property", () => {
    const out = kinds([
      healthy({ id: "z", mortgageBalance: null }),
      healthy({ id: "y", leaseEnd: "2027-01-10" }),
      healthy({ id: "x", net: -10 }),
      healthy({ id: "w", currentTenantName: null, lastLeaseEnd: "2026-11-01" }),
    ]);
    expect(out).toEqual(["lease-expired:w", "negative-net:x", "lease-ending:y", "missing-mortgage:z"]);
  });
});
