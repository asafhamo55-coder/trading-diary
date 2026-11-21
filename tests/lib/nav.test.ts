import { describe, expect, it } from "vitest";
import { buildCrumbs, NAV_AREAS, resolveNav } from "../../src/lib/nav";

describe("resolveNav", () => {
  it("matches the dashboard only at /", () => {
    expect(resolveNav("/").area?.id).toBe("dashboard");
    expect(resolveNav("/savings").area?.id).toBe("savings");
  });

  it("uses the longest prefix for sub-pages", () => {
    const loc = resolveNav("/savings/benefits");
    expect(loc.area?.id).toBe("savings");
    expect(loc.page?.href).toBe("/savings/benefits");
    expect(loc.exact).toBe(true);
    expect(resolveNav("/savings").page?.label).toBe("Accounts");
  });

  it("highlights the parent of dynamic routes", () => {
    expect(resolveNav("/properties/abc123").page?.href).toBe("/properties");
    expect(resolveNav("/properties/abc123").exact).toBe(false);
    expect(resolveNav("/trade/trades/xyz/edit").page?.href).toBe("/trade/trades");
    expect(resolveNav("/trade/monthly/3").page?.href).toBe("/trade/monthly");
  });

  it("does not match lookalike prefixes", () => {
    expect(resolveNav("/homes").area).toBeNull();
    expect(resolveNav("/home/insightsx").page?.href).toBe("/home");
  });

  it("tolerates trailing slashes and query strings", () => {
    expect(resolveNav("/home/review/").page?.href).toBe("/home/review");
    expect(resolveNav("/properties?year=2025").page?.href).toBe("/properties");
  });

  it("maps the Trade area to /trade/* even without an index", () => {
    expect(resolveNav("/trade").area?.id).toBe("trade");
    expect(resolveNav("/trade/settings").page?.label).toBe("Settings");
  });

  it("gives every area an icon and unique page hrefs", () => {
    for (const a of NAV_AREAS) {
      expect(a.icon).toBeTruthy();
      const hrefs = (a.pages ?? []).map((p) => p.href);
      expect(new Set(hrefs).size).toBe(hrefs.length);
    }
  });
});

describe("buildCrumbs", () => {
  it("dashboard is a single crumb", () => {
    expect(buildCrumbs("/")).toEqual([{ label: "Dashboard" }]);
  });

  it("area › sub-page, last without href", () => {
    expect(buildCrumbs("/savings/benefits")).toEqual([
      { label: "Retirement & Savings", href: "/savings" },
      { label: "Benefits & insurance" },
    ]);
    expect(buildCrumbs("/savings")).toEqual([
      { label: "Retirement & Savings", href: "/savings" },
      { label: "Accounts" },
    ]);
  });

  it("uses the page-provided detail title", () => {
    expect(buildCrumbs("/properties/p1", [{ label: "12 Oak St" }])).toEqual([
      { label: "Properties", href: "/properties" },
      { label: "12 Oak St" },
    ]);
    expect(
      buildCrumbs("/trade/trades/t1/edit", [{ label: "AAPL", href: "/trade/trades/t1" }, { label: "Edit" }])
    ).toEqual([
      { label: "Trade", href: "/trade/dashboard" },
      { label: "Trades", href: "/trade/trades" },
      { label: "AAPL", href: "/trade/trades/t1" },
      { label: "Edit" },
    ]);
  });

  it("falls back to a generic label for child routes", () => {
    expect(buildCrumbs("/trade/trades/new").at(-1)).toEqual({ label: "New" });
    expect(buildCrumbs("/trade/trades/t1").at(-1)).toEqual({ label: "Details" });
  });

  it("unknown paths get the product name", () => {
    expect(buildCrumbs("/nowhere")).toEqual([{ label: "Hamo Home Equity" }]);
  });
});
