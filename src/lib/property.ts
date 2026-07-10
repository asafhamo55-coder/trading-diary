// Hamo Properties — shared domain types & tax-oriented category catalog.
// Categories map to IRS Schedule E line items so the data supports tax filing.

export type PropertyTxType = "INCOME" | "EXPENSE";

export interface PropertyCategory {
  key: string;
  label: string;
  type: PropertyTxType;
  /** Schedule E line reference, for the tax summary view. */
  taxLine?: string;
}

export const PROPERTY_CATEGORIES: PropertyCategory[] = [
  // Income
  { key: "RENT", label: "Rental income", type: "INCOME", taxLine: "Line 3 — Rents received" },
  { key: "OTHER_INCOME", label: "Other income", type: "INCOME", taxLine: "Line 3 — Rents received" },
  // Expenses (Schedule E lines 5–19)
  { key: "ADVERTISING", label: "Advertising", type: "EXPENSE", taxLine: "Line 5" },
  { key: "AUTO_TRAVEL", label: "Auto & travel", type: "EXPENSE", taxLine: "Line 6" },
  { key: "CLEANING_MAINT", label: "Cleaning & maintenance", type: "EXPENSE", taxLine: "Line 7" },
  { key: "COMMISSIONS", label: "Commissions", type: "EXPENSE", taxLine: "Line 8" },
  { key: "INSURANCE", label: "Insurance", type: "EXPENSE", taxLine: "Line 9" },
  { key: "LEGAL", label: "Legal & professional fees", type: "EXPENSE", taxLine: "Line 10" },
  { key: "MANAGEMENT", label: "Management fees", type: "EXPENSE", taxLine: "Line 11" },
  { key: "MORTGAGE_INTEREST", label: "Mortgage interest", type: "EXPENSE", taxLine: "Line 12" },
  { key: "REPAIRS", label: "Repairs", type: "EXPENSE", taxLine: "Line 14" },
  { key: "SUPPLIES", label: "Supplies", type: "EXPENSE", taxLine: "Line 15" },
  { key: "PROPERTY_TAX", label: "Property taxes", type: "EXPENSE", taxLine: "Line 16" },
  { key: "UTILITIES", label: "Utilities", type: "EXPENSE", taxLine: "Line 17" },
  { key: "HOA", label: "HOA / association dues", type: "EXPENSE", taxLine: "Line 19 — Other" },
  { key: "DEPRECIATION", label: "Depreciation", type: "EXPENSE", taxLine: "Line 18" },
  { key: "OTHER", label: "Other expense", type: "EXPENSE", taxLine: "Line 19 — Other" },
];

const CATEGORY_BY_KEY = new Map(PROPERTY_CATEGORIES.map((c) => [c.key, c]));

export function getCategory(key: string): PropertyCategory | undefined {
  return CATEGORY_BY_KEY.get(key);
}

export function categoryLabel(key: string): string {
  return CATEGORY_BY_KEY.get(key)?.label ?? key;
}

export const INCOME_CATEGORIES = PROPERTY_CATEGORIES.filter((c) => c.type === "INCOME");
export const EXPENSE_CATEGORIES = PROPERTY_CATEGORIES.filter((c) => c.type === "EXPENSE");

export interface PropertyTransactionDTO {
  id: string;
  propertyId: string;
  date: string; // YYYY-MM-DD
  year: number;
  month: number;
  type: PropertyTxType;
  category: string;
  amount: number;
  description: string | null;
}

export interface PropertyDTO {
  id: string;
  nickname: string;
  address: string;
  street: string | null;
  unit: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  purchasePrice: number | null;
  purchaseDate: string | null;
  notes: string | null;
  archivedAt: string | null;
}

/** Structured address parts. */
export interface AddressParts {
  street?: string | null;
  unit?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
}

/** Compose a single-line address from its parts, skipping any that are blank. */
export function composeAddress(p: AddressParts): string {
  const s = (v?: string | null) => (v ?? "").trim();
  const line1 = [s(p.street), s(p.unit) ? `#${s(p.unit)}` : ""]
    .filter(Boolean)
    .join(" ");
  const cityState = [s(p.city), [s(p.state), s(p.zip)].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(", ");
  return [line1, cityState].filter(Boolean).join(", ");
}

/** Display title for a property now that there's no nickname: street, else the full address. */
export function propertyTitle(p: {
  street?: string | null;
  address?: string | null;
  nickname?: string | null;
}): string {
  return (
    (p.street ?? "").trim() ||
    (p.address ?? "").trim() ||
    (p.nickname ?? "").trim() ||
    "Property"
  );
}

export interface TenantDTO {
  id: string;
  propertyId: string;
  name: string;
  email: string | null;
  phone: string | null;
  leaseStart: string; // YYYY-MM-DD
  leaseEnd: string | null; // null = current / ongoing
  monthlyRent: number | null;
  securityDeposit: number | null;
  notes: string | null;
}

/**
 * A tenant is "current" when the lease hasn't ended yet (no end date, or the
 * end date is today or later). `today` is passed in as YYYY-MM-DD so callers
 * control the reference date (and server/client stay consistent).
 */
export function isCurrentTenant(t: TenantDTO, today: string): boolean {
  return t.leaseEnd === null || t.leaseEnd >= today;
}

/** Sort tenants newest-lease first (most recent / current at the top). */
export function sortTenantsByRecency(tenants: TenantDTO[]): TenantDTO[] {
  return [...tenants].sort((a, b) => b.leaseStart.localeCompare(a.leaseStart));
}

/** Signed contribution of a transaction to net income (+income, −expense). */
export function signedAmount(t: { type: PropertyTxType; amount: number }): number {
  return t.type === "INCOME" ? t.amount : -t.amount;
}

export const MONTH_ABBR = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;

/**
 * Months elapsed in `year` as of `today` (YYYY-MM-DD): 12 for past years,
 * the current month number for the ongoing year, 0 for future years.
 */
export function monthsElapsed(year: number, today: string): number {
  const nowYear = Number(today.slice(0, 4));
  const nowMonth = Number(today.slice(5, 7));
  if (year < nowYear) return 12;
  if (year > nowYear) return 0;
  return nowMonth;
}

/** Signed net (income − expense) per calendar month for a set of transactions. */
export function monthlyNet(
  transactions: { month: number; type: PropertyTxType; amount: number }[]
): number[] {
  const net = Array.from({ length: 12 }, () => 0);
  for (const t of transactions) {
    const idx = t.month - 1;
    if (idx < 0 || idx > 11) continue;
    net[idx] += signedAmount(t);
  }
  return net;
}

/** The tenant whose lease is current as of `today`, most-recent lease first. */
export function currentTenantOf(
  tenants: TenantDTO[],
  today: string
): TenantDTO | null {
  return (
    sortTenantsByRecency(tenants).find((t) => isCurrentTenant(t, today)) ?? null
  );
}

/**
 * Share of tracked months in `year` that had an active lease. `totalMonths` is
 * the number of elapsed months (0 if the year hasn't started); `occupiedMonths`
 * counts elapsed months overlapped by any lease.
 */
export function occupancyForYear(
  tenants: TenantDTO[],
  year: number,
  today: string
): { occupiedMonths: number; totalMonths: number; pct: number } {
  const totalMonths = monthsElapsed(year, today);
  if (totalMonths === 0) return { occupiedMonths: 0, totalMonths: 0, pct: 0 };
  let occupied = 0;
  for (let m = 1; m <= totalMonths; m++) {
    // Month m of `year` counts as occupied if any lease overlaps it.
    const monthStart = `${year}-${String(m).padStart(2, "0")}-01`;
    const monthEnd = `${year}-${String(m).padStart(2, "0")}-28`;
    const covered = tenants.some(
      (t) => t.leaseStart <= monthEnd && (t.leaseEnd === null || t.leaseEnd >= monthStart)
    );
    if (covered) occupied++;
  }
  return {
    occupiedMonths: occupied,
    totalMonths,
    pct: (occupied / totalMonths) * 100,
  };
}

/**
 * Annualized yield: net operating income (extrapolated from `elapsedMonths` to a
 * full year) as a percentage of purchase price. Null when price/elapsed missing.
 */
export function yieldPct(
  net: number,
  purchasePrice: number | null,
  elapsedMonths: number
): number | null {
  if (!purchasePrice || purchasePrice <= 0 || elapsedMonths <= 0) return null;
  const annualized = (net / elapsedMonths) * 12;
  return (annualized / purchasePrice) * 100;
}

export interface PropertyYearSummary {
  income: number;
  expenses: number;
  net: number;
  byCategory: { key: string; label: string; type: PropertyTxType; total: number }[];
}

/** Aggregate a property's transactions for a given year into a tax-style summary. */
export function summarizeYear(
  transactions: { type: PropertyTxType; category: string; amount: number; year: number }[],
  year: number
): PropertyYearSummary {
  const rows = transactions.filter((t) => t.year === year);
  let income = 0;
  let expenses = 0;
  const totals = new Map<string, number>();
  for (const t of rows) {
    if (t.type === "INCOME") income += t.amount;
    else expenses += t.amount;
    totals.set(t.category, (totals.get(t.category) ?? 0) + t.amount);
  }
  // Preserve the catalog order for a stable, tax-form-like layout.
  const byCategory = PROPERTY_CATEGORIES.filter((c) => totals.has(c.key)).map((c) => ({
    key: c.key,
    label: c.label,
    type: c.type,
    total: totals.get(c.key) ?? 0,
  }));
  return { income, expenses, net: income - expenses, byCategory };
}
