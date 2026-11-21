// Hamo Properties — portfolio-level shaping for the properties list: the row
// shape the server hands the client, building grouping with building totals,
// and the rental-only headline figures. Pure (no React, no Prisma) so it is
// unit-tested and shared by the server page and the client view.

import {
  CLOSING_PCT,
  REALTOR_PCT,
  buildingCashForYear,
  buildingKey,
  currentTenantOf,
  forReturns,
  monthlyNet,
  monthsElapsed,
  occupancyForYear,
  propertyTitle,
  sortTenantsByRecency,
  stripUnitDesignator,
  summarizeYear,
  taxOnlyCount,
  unitLabelOf,
  yieldPct,
} from "./property";
import type { PropertyWithTx } from "./property-data";

/** One property as the properties list sees it (built in app/properties/page.tsx). */
export interface PropertyRow {
  id: string;
  title: string;
  address: string;
  unit: string | null;
  /** Same key for every unit of one building (see `buildingKey`). */
  buildingKey: string;
  archived: boolean;
  /** "rental" or "residence" (the family's own home: net worth only). */
  usage: string;
  txCount: number;
  income: number;
  expenses: number;
  net: number;
  monthlyNet: number[];
  taxOnlyCount: number;
  hasTenants: boolean;
  occupiedMonths: number;
  occupancyMonths: number;
  occupancyPct: number | null;
  currentTenantName: string | null;
  monthlyRent: number | null;
  /** Current lease dates (null when vacant or open-ended). */
  leaseStart: string | null;
  leaseEnd: string | null;
  /** When vacant: the most recent lease's end date, if any lease is on record. */
  lastLeaseEnd: string | null;
  purchasePrice: number | null;
  downPayment: number | null;
  purchaseDate: string | null;
  currentValue: number | null;
  valueAsOf: string | null;
  mortgageBalance: number | null;
  mortgageAsOf: string | null;
  yieldPct: number | null;
  /** Return on cash invested, summed across the units of this building. */
  cashOnCashPct: number | null;
  /** Down payment(s) behind that return: the building's, not just this unit's. */
  cashInvested: number;
  /** Units sharing this building; > 1 means the figure spans siblings. */
  unitCount: number;
  /** Active building with no down payment recorded: cash-on-cash can't be computed. */
  needsDownPayment: boolean;
}

export const isResidence = (r: Pick<PropertyRow, "usage">) => r.usage === "residence";

/** Value − mortgage. A missing mortgage counts as $0 (flagged elsewhere); null without a value. */
export function equityOf(r: Pick<PropertyRow, "currentValue" | "mortgageBalance">): number | null {
  return r.currentValue == null ? null : r.currentValue - (r.mortgageBalance ?? 0);
}

/** Appreciation vs purchase price as a fraction, or null without both figures. */
export function appreciationOf(r: Pick<PropertyRow, "currentValue" | "purchasePrice">): number | null {
  return r.currentValue != null && r.purchasePrice && r.purchasePrice > 0
    ? (r.currentValue - r.purchasePrice) / r.purchasePrice
    : null;
}

export interface BuildingTotals {
  income: number;
  expenses: number;
  net: number;
  /** Sum of known values; `valuedUnits` says how many units it covers. */
  value: number | null;
  valuedUnits: number;
  mortgage: number | null;
  equity: number | null;
  purchasePrice: number | null;
  appreciationPct: number | null;
  yieldPct: number | null;
  cashOnCashPct: number | null;
  cashInvested: number;
  leasedUnits: number;
  units: number;
  monthlyNet: number[];
}

export type BuildingEntry =
  | { kind: "single"; key: string; row: PropertyRow }
  | { kind: "building"; key: string; title: string; address: string; units: PropertyRow[]; totals: BuildingTotals };

function sumKnown(values: (number | null)[]): number | null {
  const known = values.filter((v): v is number => v != null);
  return known.length ? known.reduce((s, v) => s + v, 0) : null;
}

/** Roll the units of one building up to building totals. */
export function buildingTotals(units: PropertyRow[], elapsed: number): BuildingTotals {
  const valued = units.filter((u) => u.currentValue != null);
  const value = sumKnown(units.map((u) => u.currentValue));
  // Appreciation only over units that have both a value and a purchase price,
  // so a unit missing one figure can't skew the ratio.
  const priced = valued.filter((u) => u.purchasePrice && u.purchasePrice > 0);
  const pricedValue = priced.reduce((s, u) => s + (u.currentValue ?? 0), 0);
  const pricedCost = priced.reduce((s, u) => s + (u.purchasePrice ?? 0), 0);
  const purchasePrice = sumKnown(units.map((u) => (u.purchasePrice && u.purchasePrice > 0 ? u.purchasePrice : null)));
  const net = units.reduce((s, u) => s + u.net, 0);
  const monthlyNet = Array.from({ length: 12 }, (_, i) => units.reduce((s, u) => s + (u.monthlyNet[i] ?? 0), 0));
  return {
    income: units.reduce((s, u) => s + u.income, 0),
    expenses: units.reduce((s, u) => s + u.expenses, 0),
    net,
    value,
    valuedUnits: valued.length,
    mortgage: sumKnown(units.map((u) => u.mortgageBalance)),
    equity: sumKnown(units.map(equityOf)),
    purchasePrice,
    appreciationPct: pricedCost > 0 ? (pricedValue - pricedCost) / pricedCost : null,
    // Yield over the units that carry a price, matching the per-unit definition.
    yieldPct: yieldPct(
      units.reduce((s, u) => s + (u.purchasePrice && u.purchasePrice > 0 ? u.net : 0), 0),
      purchasePrice,
      elapsed
    ),
    // Every unit of a building already carries the building's figure.
    cashOnCashPct: units[0]?.cashOnCashPct ?? null,
    cashInvested: units[0]?.cashInvested ?? 0,
    leasedUnits: units.filter((u) => u.currentTenantName != null).length,
    units: units.length,
    monthlyNet,
  };
}

/**
 * Group rows by building, keeping first-seen order. A building with one unit
 * stays a plain row; two or more become a building entry with totals.
 */
export function groupByBuilding(rows: PropertyRow[], elapsed: number): BuildingEntry[] {
  const order: string[] = [];
  const byKey = new Map<string, PropertyRow[]>();
  for (const r of rows) {
    const list = byKey.get(r.buildingKey);
    if (list) list.push(r);
    else {
      byKey.set(r.buildingKey, [r]);
      order.push(r.buildingKey);
    }
  }
  return order.map((key): BuildingEntry => {
    const units = byKey.get(key)!;
    if (units.length === 1) return { kind: "single", key, row: units[0] };
    const first = units[0];
    const title = stripUnitDesignator(first.title);
    return {
      kind: "building",
      key,
      title,
      address: first.address,
      units,
      totals: buildingTotals(units, elapsed),
    };
  });
}

/* ── Sorting ─────────────────────────────────────────────────────────── */

export type PropertySortKey =
  | "property"
  | "status"
  | "net"
  | "coc"
  | "yield"
  | "value"
  | "mortgage"
  | "equity"
  | "appreciation";

export type SortDir = "asc" | "desc";

type Sortable = string | number | null;

function rowSortValue(r: PropertyRow, key: PropertySortKey): Sortable {
  switch (key) {
    case "property":
      return r.title.toLowerCase();
    case "status":
      return r.currentTenantName ? 1 : 0;
    case "net":
      return r.net;
    case "coc":
      return r.cashOnCashPct;
    case "yield":
      return r.yieldPct;
    case "value":
      return r.currentValue;
    case "mortgage":
      return r.mortgageBalance;
    case "equity":
      return equityOf(r);
    case "appreciation":
      return appreciationOf(r);
  }
}

function entrySortValue(e: BuildingEntry, key: PropertySortKey): Sortable {
  if (e.kind === "single") return rowSortValue(e.row, key);
  const t = e.totals;
  switch (key) {
    case "property":
      return e.title.toLowerCase();
    case "status":
      return t.units ? t.leasedUnits / t.units : 0;
    case "net":
      return t.net;
    case "coc":
      return t.cashOnCashPct;
    case "yield":
      return t.yieldPct;
    case "value":
      return t.value;
    case "mortgage":
      return t.mortgage;
    case "equity":
      return t.equity;
    case "appreciation":
      return t.appreciationPct;
  }
}

/** Compare with blanks always last, whichever the direction. */
function compare(a: Sortable, b: Sortable, dir: SortDir): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  const c = typeof a === "string" && typeof b === "string" ? a.localeCompare(b) : (a as number) - (b as number);
  return dir === "asc" ? c : -c;
}

/** Sort buildings by their totals and the units inside each by the same key. Stable. */
export function sortEntries(entries: BuildingEntry[], key: PropertySortKey, dir: SortDir): BuildingEntry[] {
  return entries
    .map((e) =>
      e.kind === "building"
        ? { ...e, units: [...e.units].sort((a, b) => compare(rowSortValue(a, key), rowSortValue(b, key), dir)) }
        : e
    )
    .sort((a, b) => compare(entrySortValue(a, key), entrySortValue(b, key), dir));
}

/* ── Headline figures (rentals only) ─────────────────────────────────── */

export interface PortfolioKpis {
  rentals: number;
  /** Σ current value over rentals that have one. */
  value: number;
  valuedCount: number;
  /** Σ (value − mortgage) over valued rentals; a missing mortgage counts as $0. */
  equity: number;
  /** Valued rentals with no mortgage balance on file. */
  missingMortgage: number;
  net: number;
  avgNetPerMonth: number | null;
  /** Σ net / Σ cash invested, one figure per building with a down payment. */
  cashOnCashPct: number | null;
  cashInvested: number;
  leased: number;
  /** Appreciation over rentals with both a value and a purchase price. */
  appreciationPct: number | null;
  appreciationGain: number;
  /** Profit if every priced rental sold today, after realtor + closing costs. */
  netIfSold: number | null;
  /** Residences: value − mortgage (net worth only). */
  homeEquity: number | null;
}

export function portfolioKpis(rows: PropertyRow[], elapsed: number): PortfolioKpis {
  const active = rows.filter((r) => !r.archived);
  const rentals = active.filter((r) => !isResidence(r));
  const homes = active.filter(isResidence);

  const valued = rentals.filter((r) => r.currentValue != null);
  const priced = valued.filter((r) => r.purchasePrice && r.purchasePrice > 0);
  const pricedValue = priced.reduce((s, r) => s + (r.currentValue ?? 0), 0);
  const pricedCost = priced.reduce((s, r) => s + (r.purchasePrice ?? 0), 0);

  // Cash-on-cash per building: count each building's cash once, and only the
  // net of buildings that have cash on file.
  const buildings = new Map<string, { net: number; cash: number }>();
  for (const r of rentals) {
    const b = buildings.get(r.buildingKey) ?? { net: 0, cash: r.cashInvested };
    b.net += r.net;
    buildings.set(r.buildingKey, b);
  }
  let cocNet = 0;
  let cash = 0;
  for (const b of buildings.values()) {
    if (b.cash > 0) {
      cocNet += b.net;
      cash += b.cash;
    }
  }

  const net = rentals.reduce((s, r) => s + r.net, 0);
  const homeEquity = sumKnown(homes.map(equityOf));

  return {
    rentals: rentals.length,
    value: valued.reduce((s, r) => s + (r.currentValue ?? 0), 0),
    valuedCount: valued.length,
    equity: valued.reduce((s, r) => s + (equityOf(r) ?? 0), 0),
    missingMortgage: valued.filter((r) => r.mortgageBalance == null).length,
    net,
    avgNetPerMonth: elapsed > 0 ? net / elapsed : null,
    cashOnCashPct: cash > 0 ? (cocNet / cash) * 100 : null,
    cashInvested: cash,
    leased: rentals.filter((r) => r.currentTenantName != null).length,
    appreciationPct: pricedCost > 0 ? (pricedValue - pricedCost) / pricedCost : null,
    appreciationGain: pricedValue - pricedCost,
    netIfSold: pricedCost > 0 ? pricedValue * (1 - REALTOR_PCT - CLOSING_PCT) - pricedCost : null,
    homeEquity,
  };
}

/* ── Rows (server-side shaping for the list and detail pages) ────────── */

/** "22 Birch Rd #2": units of one building need telling apart in lists and charts. */
export function titleWithUnit(p: { street?: string | null; address?: string | null; nickname?: string | null; unit?: string | null }) {
  const title = propertyTitle(p);
  const unit = unitLabelOf(p);
  return unit && stripUnitDesignator(title) === title ? `${title} #${unit}` : title;
}

/**
 * Properties (with transactions and tenants) → list rows for `year`, as of
 * `today`. Called by the server pages; the client only renders the result.
 */
export function buildPropertyRows(properties: PropertyWithTx[], year: number, today: string): PropertyRow[] {
  const elapsed = monthsElapsed(year, today);
  const rows = properties.map((p) => {
    const yearTx = p.transactions.filter((t) => t.year === year);
    // Performance figures read the tax-only entries out; the entry count below
    // still describes the full list, since that is what the detail page shows.
    const summary = summarizeYear(forReturns(p.transactions), year);
    const occ = occupancyForYear(p.tenants, year, today);
    const current = currentTenantOf(p.tenants, today);
    // When vacant, the most recent lease that has ended tells how long for.
    const lastEnded = current
      ? null
      : sortTenantsByRecency(p.tenants).find((t) => t.leaseEnd !== null && t.leaseEnd < today) ?? null;
    return {
      id: p.id,
      title: titleWithUnit(p),
      address: p.address,
      unit: unitLabelOf(p),
      buildingKey: buildingKey(p),
      archived: p.archivedAt !== null,
      txCount: yearTx.length,
      income: summary.income,
      expenses: summary.expenses,
      net: summary.net,
      monthlyNet: monthlyNet(forReturns(yearTx)),
      taxOnlyCount: taxOnlyCount(yearTx),
      hasTenants: p.tenants.length > 0,
      occupiedMonths: occ.occupiedMonths,
      occupancyMonths: occ.totalMonths,
      occupancyPct: occ.totalMonths > 0 ? occ.pct : null,
      currentTenantName: current?.name ?? null,
      monthlyRent: current?.monthlyRent ?? null,
      leaseStart: current?.leaseStart ?? null,
      leaseEnd: current?.leaseEnd ?? null,
      lastLeaseEnd: lastEnded?.leaseEnd ?? null,
      purchasePrice: p.purchasePrice,
      downPayment: p.downPayment,
      purchaseDate: p.purchaseDate,
      currentValue: p.currentValue,
      valueAsOf: p.valueAsOf,
      mortgageBalance: p.mortgageBalance,
      mortgageAsOf: p.mortgageAsOf,
      usage: p.usage,
      yieldPct: yieldPct(summary.net, p.purchasePrice, elapsed),
    };
  });

  // Return on the cash invested, rolled up to the building so a multi-unit
  // address reports one figure across its units. Shared with the detail page so
  // the two never disagree; archived properties and tax-only entries are
  // excluded inside the helper.
  const cashByProperty = buildingCashForYear(properties, year);
  return rows.map((r) => {
    const cash = cashByProperty.get(r.id);
    return {
      ...r,
      cashOnCashPct: cash?.cashOnCashPct ?? null,
      cashInvested: cash?.downPayment ?? 0,
      unitCount: cash?.unitCount ?? 1,
      // Active building with entries but no down payment on file anywhere —
      // the card invites you to add one rather than guessing at a basis.
      needsDownPayment: cash != null && cash.downPayment <= 0,
    };
  });

}
