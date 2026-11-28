// What the advisor sees of the filed tax returns: a compact copy of the last
// two years, plus a per-rental check of the latest declared Schedule E against
// the current year's books annualized (the books before 2026 come from the
// returns themselves, so same-year comparisons would be circular). Pure.
import type { PropertyWithTx } from "./property-data";
import { matchRentals } from "./tax-return-backfill";
import type { TaxReturnDTO } from "./tax-return-data";
import type { TaxReturnInput } from "./tax-return-schema";

export type AdvisorTaxReturn = Omit<TaxReturnInput, "source">;

const MAX_NOTE = 300;

/** The latest two tax years (all jurisdictions), newest first, federal before state. */
export function compactTaxReturns(returns: TaxReturnDTO[]): AdvisorTaxReturn[] {
  const years = [...new Set(returns.map((r) => r.taxYear))].sort((a, b) => b - a).slice(0, 2);
  return returns
    .filter((r) => years.includes(r.taxYear))
    .sort((a, b) => b.taxYear - a.taxYear || a.jurisdiction.localeCompare(b.jurisdiction))
    .map(({ id: _id, updatedAt: _u, source: _s, ...r }) => ({
      ...r,
      data: { ...r.data, notes: r.data.notes.filter((n) => n.length <= MAX_NOTE) },
    }));
}

type Figures = { rent: number; interest: number; depreciation: number; totalExpenses: number };

export interface RentalReconciliation {
  propertyId: string;
  propertyIds: string[];
  declaredYear: number;
  declared: Figures;
  booksRunRate: Figures & { months: number };
  diffs: { field: keyof Figures; declared: number; runRate: number; pct: number }[];
}

const round = (n: number) => Math.round(n);

export function reconcileRentals(
  returns: TaxReturnDTO[],
  properties: (Pick<PropertyWithTx, "id" | "transactions"> & Partial<Pick<PropertyWithTx, "address" | "street">>)[],
  today: string
): RentalReconciliation[] {
  const latest = returns
    .filter((r) => r.jurisdiction === "US-federal" && !r.partial)
    .sort((a, b) => b.taxYear - a.taxYear)[0];
  if (!latest) return [];
  const year = Number(today.slice(0, 4));
  const calendarMonths = Math.max(1, Number(today.slice(5, 7)));
  // Annualize over the months the books actually cover (statements arrive in
  // batches), never beyond today's month.
  const bookMonths = properties
    .flatMap((p) => p.transactions)
    .filter((t) => t.year === year && !t.source?.startsWith("taxReturn:"))
    .reduce((m, t) => Math.max(m, t.month), 0);
  const months = Math.min(calendarMonths, Math.max(1, bookMonths || calendarMonths));
  const { matched } = matchRentals(
    latest.data.rentals,
    properties.map((p) => ({ id: p.id, address: p.address ?? "", street: p.street }))
  );
  const out: RentalReconciliation[] = [];
  for (const { rental, propertyIds } of matched) {
    const own = properties.filter((p) => propertyIds.includes(p.id));
    if (own.length === 0) continue;
    const l = rental.lines;
    const expenseTotal = Object.entries(l)
      .filter(([k, v]) => k !== "RENT" && k !== "OTHER_INCOME" && k !== "DEPRECIATION" && v != null && v > 0)
      .reduce((s, [, v]) => s + (v ?? 0), 0);
    const declared: Figures = {
      rent: l.RENT ?? 0,
      interest: l.MORTGAGE_INTEREST ?? 0,
      depreciation: l.DEPRECIATION ?? 0,
      totalExpenses: expenseTotal,
    };
    const tx = own.flatMap((p) => p.transactions).filter((t) => t.year === year && !t.source?.startsWith("taxReturn:"));
    const sum = (pred: (t: (typeof tx)[number]) => boolean) => (tx.filter(pred).reduce((s, t) => s + t.amount, 0) * 12) / months;
    const booksRunRate = {
      months,
      rent: round(sum((t) => t.category === "RENT")),
      interest: round(sum((t) => t.category === "MORTGAGE_INTEREST")),
      depreciation: round(sum((t) => t.category === "DEPRECIATION")),
      totalExpenses: round(sum((t) => t.type === "EXPENSE" && t.category !== "DEPRECIATION")),
    };
    // Depreciation isn't booked month to month, so it is reported but never diffed.
    const diffs = (["rent", "interest", "totalExpenses"] as const).flatMap((field) => {
      const d = declared[field];
      const r = booksRunRate[field];
      const pct = d === 0 ? (r === 0 ? 0 : 100) : Math.round(((r - d) / d) * 100);
      return Math.abs(pct) >= 25 && Math.abs(r - d) >= 500 ? [{ field, declared: d, runRate: r, pct }] : [];
    });
    out.push({ propertyId: propertyIds[0], propertyIds, declaredYear: latest.taxYear, declared, booksRunRate, diffs });
  }
  return out;
}
