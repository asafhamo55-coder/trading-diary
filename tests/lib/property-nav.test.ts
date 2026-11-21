import { describe, expect, it } from "vitest";

import { groupPropertyNav, toPropertyNavItems, unitNavLabel } from "../../src/lib/property-nav";
import { unitLabelOf } from "../../src/lib/property";

function prop(over: Partial<Parameters<typeof toPropertyNavItems>[0][number]> & { id: string }) {
  return {
    nickname: null,
    address: "",
    street: null,
    unit: null,
    city: null,
    state: null,
    zip: null,
    usage: "rental",
    archivedAt: null,
    ...over,
  };
}

describe("unitLabelOf", () => {
  it("reads the unit field, a trailing street unit, or a unit segment of the address", () => {
    expect(unitLabelOf({ unit: "4B" })).toBe("4B");
    expect(unitLabelOf({ unit: "#2" })).toBe("2");
    expect(unitLabelOf({ street: "12 Example Ave Unit 3" })).toBe("3");
    expect(unitLabelOf({ address: "12 Example Ave, Apt 1, Springfield, ZZ 00000" })).toBe("1");
    expect(unitLabelOf({ street: "7 Bldg Way" })).toBeNull();
  });
});

describe("toPropertyNavItems", () => {
  it("drops archived properties and names only shared buildings", () => {
    const items = toPropertyNavItems([
      prop({ id: "a", street: "12 Example Ave", unit: "1", state: "ZZ", zip: "00000", address: "12 Example Ave #1, ZZ 00000" }),
      // Same building, recorded only as a one-line address.
      prop({ id: "b", address: "12 Example Ave, Unit 2, Springfield, ZZ, 00000" }),
      prop({ id: "c", street: "9 Sample Rd", state: "ZZ", zip: "00001", address: "9 Sample Rd, ZZ 00001" }),
      prop({ id: "d", street: "1 Old Ln", address: "1 Old Ln", archivedAt: "2026-01-01T00:00:00.000Z" }),
      prop({ id: "h", street: "5 Home Ct", address: "5 Home Ct", usage: "residence" }),
    ]);
    expect(items.map((i) => i.id)).toEqual(["a", "b", "c", "h"]);
    expect(items[0]).toMatchObject({ building: "12 Example Ave", unit: "1" });
    expect(items[1]).toMatchObject({ building: "12 Example Ave", unit: "2" });
    expect(items[2].building).toBeUndefined();
    expect(items[3]).toMatchObject({ usage: "residence", title: "5 Home Ct" });
  });
});

describe("groupPropertyNav", () => {
  it("puts the residence first, sorts by title and nests units in numeric order", () => {
    const tree = groupPropertyNav([
      { id: "z", title: "Zed St", usage: "rental" },
      { id: "u10", title: "Main #10", building: "Main", unit: "10", usage: "rental" },
      { id: "home", title: "Home Ct", usage: "residence" },
      { id: "u2", title: "Main #2", building: "Main", unit: "2", usage: "rental" },
      { id: "a", title: "Alpha Rd", usage: "rental" },
    ]);
    expect(tree.map((n) => (n.kind === "property" ? n.item.id : `b:${n.title}`))).toEqual([
      "home",
      "a",
      "b:Main",
      "z",
    ]);
    const b = tree[2];
    if (b.kind !== "building") throw new Error("expected building");
    expect(b.units.map((u) => u.id)).toEqual(["u2", "u10"]);
    expect(unitNavLabel(b.units[0])).toBe("Unit 2");
  });

  it("handles an empty list", () => {
    expect(groupPropertyNav([])).toEqual([]);
  });
});
