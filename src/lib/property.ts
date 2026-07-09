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
  purchasePrice: number | null;
  purchaseDate: string | null;
  notes: string | null;
  archivedAt: string | null;
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
