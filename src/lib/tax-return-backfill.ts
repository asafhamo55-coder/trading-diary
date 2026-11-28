// Schedule E → property books. The Properties module only has statement books
// from 2026, so earlier years come from the filed return: one transaction per
// non-zero Schedule E line, dated Dec 31 and tagged `source: "taxReturn:<year>"`
// so a re-ingest replaces only those rows. Pure (the DB write is in
// tax-return-data.ts).
import { getCategory } from "./property";
import type { ScheduleERental } from "./tax-return-schema";

export interface NewTx {
  propertyId: string;
  date: Date;
  year: number;
  month: 12;
  type: "INCOME" | "EXPENSE";
  category: string;
  amount: number;
  description: string;
  source: string;
}

export const taxReturnSource = (year: number) => `taxReturn:${year}`;

/** Rows a statement re-import may replace: never generated (sourced) rows. */
export const statementRowsWhere = (propertyId: string) => ({ propertyId, source: null });

/** Every row a year's backfill created, on any of the account's properties. */
export const backfillDeleteWhere = (accountId: string, year: number) => ({
  source: taxReturnSource(year),
  property: { accountId },
});

/**
 * Drop properties that already have statement books for the year — the
 * backfill only fills years the app has no books for (otherwise a later
 * return would double-count on top of them).
 */
export function excludeBookedProperties<M extends { propertyIds: string[] }>(
  matched: M[],
  booked: Set<string>
): { matched: M[]; booked: string[] } {
  const skipped = new Set<string>();
  const out = matched.flatMap((m) => {
    const ids = m.propertyIds.filter((id) => (booked.has(id) ? (skipped.add(id), false) : true));
    return ids.length ? [{ ...m, propertyIds: ids }] : [];
  });
  return { matched: out, booked: [...skipped] };
}

const SUFFIXES: Record<string, string> = {
  CIRCLE: "CIR",
  COURT: "CT",
  ROAD: "RD",
  DRIVE: "DR",
  STREET: "ST",
  AVENUE: "AVE",
  LANE: "LN",
  BOULEVARD: "BLVD",
  PLACE: "PL",
};

/** "1104 EXAMPLE CIRCLE NW" → "1104 EXAMPLE": street number + first street word. */
function streetKey(s: string): string | null {
  const words = s
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => SUFFIXES[w] ?? w);
  const i = words.findIndex((w) => /^\d+$/.test(w));
  return i >= 0 && words[i + 1] ? `${words[i]} ${words[i + 1]}` : null;
}

export function matchRentals(
  rentals: ScheduleERental[],
  properties: { id: string; address: string; street?: string | null; unit?: string | null }[]
): { matched: { rental: ScheduleERental; propertyIds: string[] }[]; unmatched: string[] } {
  const matched: { rental: ScheduleERental; propertyIds: string[] }[] = [];
  const unmatched: string[] = [];
  for (const rental of rentals) {
    let ids = rental.unitIds?.length ? rental.unitIds : rental.propertyId ? [rental.propertyId] : null;
    if (!ids) {
      const key = streetKey(rental.address);
      ids = key ? properties.filter((p) => streetKey(p.street || p.address) === key).map((p) => p.id) : [];
    }
    if (ids.length) matched.push({ rental, propertyIds: ids });
    else unmatched.push(rental.address);
  }
  return { matched, unmatched };
}

/** Split `amount` by weights, in cents, with the rounding remainder on the first share. */
function split(amount: number, weights: number[]): number[] {
  const cents = Math.round(amount * 100);
  const total = weights.reduce((s, w) => s + w, 0);
  const shares = weights.map((w) => Math.floor((cents * w) / total));
  shares[0] += cents - shares.reduce((s, c) => s + c, 0);
  return shares.map((c) => c / 100);
}

export function scheduleEToTransactions(
  rental: ScheduleERental,
  year: number,
  propertyIds: string[],
  unitRents?: Record<string, number>
): NewTx[] {
  const weights = propertyIds.map((id) => (unitRents && unitRents[id] > 0 ? unitRents[id] : unitRents ? 0 : 1));
  const usable = weights.some((w) => w > 0) ? weights : propertyIds.map(() => 1);
  const date = new Date(Date.UTC(year, 11, 31));
  const out: NewTx[] = [];
  for (const [category, amount] of Object.entries(rental.lines)) {
    const cat = getCategory(category);
    if (!cat || amount == null || amount <= 0) continue;
    split(amount, usable).forEach((share, i) => {
      if (share <= 0) return;
      out.push({
        propertyId: propertyIds[i],
        date,
        year,
        month: 12,
        type: cat.type,
        category,
        amount: share,
        description: `${year} Schedule E — from filed return`,
        source: taxReturnSource(year),
      });
    });
  }
  return out;
}

type Basis = Partial<Record<"landValue" | "buildingValue" | "placedInService" | "method", unknown>> & Record<string, unknown>;

/**
 * Fill the property's tax-basis section from the return's depreciation report,
 * only where the user left a field empty. Null when nothing would change.
 */
export function fillTaxBasis<T extends Basis>(
  existing: T | undefined | null,
  dep: ScheduleERental["depreciation"],
  /** This unit's share of a multi-unit building (1 for a single property). */
  share = 1
): (T & Basis) | null {
  if (!dep) return null;
  const part = (n: number) => Math.round(n * share * 100) / 100;
  // `basis` is the total cost basis including land (see the extraction guide).
  const from: Basis = {
    landValue: dep.land != null ? part(dep.land) : null,
    buildingValue: dep.basis != null ? part(dep.basis - (dep.land ?? 0)) : null,
    placedInService: dep.placedInService,
    method: dep.method,
  };
  const out: Basis = { ...(existing ?? {}) };
  let changed = false;
  for (const [k, v] of Object.entries(from)) {
    if (v == null || (out[k] != null && out[k] !== "")) continue;
    out[k] = v;
    changed = true;
  }
  return changed ? (out as T & Basis) : null;
}
