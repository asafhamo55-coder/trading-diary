// Hamo Home — shared domain types, account-source metadata, and the default
// two-level category taxonomy used to seed a new household.

export type HomeAccountType = "BOFA_CHECKING" | "BOFA_CARD" | "AMEX" | "OTHER";
export type HomeCategoryKind = "SPENDING" | "INCOME" | "TRANSFER";

export const ACCOUNT_TYPES: {
  key: HomeAccountType;
  label: string;
  short: string;
  /** Whether this source's outflows can be a credit-card payment to dedupe. */
  isBank: boolean;
  /** Whether this source is itself a credit card (purchases are real spend). */
  isCard: boolean;
}[] = [
  { key: "BOFA_CHECKING", label: "Bank of America — Checking", short: "BofA Checking", isBank: true, isCard: false },
  { key: "BOFA_CARD", label: "Bank of America — Credit Card", short: "BofA Card", isBank: false, isCard: true },
  { key: "AMEX", label: "American Express", short: "Amex", isBank: false, isCard: true },
  { key: "OTHER", label: "Other account", short: "Other", isBank: true, isCard: false },
];

export function accountTypeLabel(type: HomeAccountType): string {
  return ACCOUNT_TYPES.find((t) => t.key === type)?.label ?? type;
}
export function accountTypeShort(type: HomeAccountType): string {
  return ACCOUNT_TYPES.find((t) => t.key === type)?.short ?? type;
}

// ── Default category taxonomy ──────────────────────────────────────
// A two-level starting set. Users can rename / add / delete freely; these are
// just seeds so the review queue and auto-tagging have something to work with.

export interface SeedCategory {
  name: string;
  kind: HomeCategoryKind;
  color: string;
  children: string[];
}

export const DEFAULT_CATEGORIES: SeedCategory[] = [
  {
    name: "Home",
    kind: "SPENDING",
    color: "#3B82F6",
    children: ["Mortgage / Rent", "Utilities", "Internet & Phone", "Repairs & Maintenance", "Furnishings", "HOA", "Property Tax", "Home Insurance"],
  },
  {
    name: "Food",
    kind: "SPENDING",
    color: "#00D68F",
    children: ["Groceries", "Dining out", "Coffee", "Delivery"],
  },
  {
    name: "Transport",
    kind: "SPENDING",
    color: "#FFB547",
    children: ["Gas", "Rideshare & Taxi", "Public transit", "Parking & Tolls", "Auto Insurance", "Auto Maintenance", "Car Payment"],
  },
  {
    name: "Health",
    kind: "SPENDING",
    color: "#FF4D6A",
    children: ["Doctor", "Pharmacy", "Dental", "Health Insurance", "Fitness"],
  },
  {
    name: "Kids",
    kind: "SPENDING",
    color: "#A78BFA",
    children: ["Childcare", "School", "Activities", "Kids Supplies"],
  },
  {
    name: "Shopping",
    kind: "SPENDING",
    color: "#F472B6",
    children: ["Clothing", "Electronics", "Household Goods", "General / Amazon"],
  },
  {
    name: "Entertainment",
    kind: "SPENDING",
    color: "#22D3EE",
    children: ["Streaming", "Events", "Hobbies", "Games"],
  },
  {
    name: "Subscriptions",
    kind: "SPENDING",
    color: "#818CF8",
    children: ["Software", "Memberships", "News & Media"],
  },
  {
    name: "Travel",
    kind: "SPENDING",
    color: "#2DD4BF",
    children: ["Flights", "Hotels", "Rental Car", "Vacation"],
  },
  {
    name: "Personal",
    kind: "SPENDING",
    color: "#FB923C",
    children: ["Personal Care", "Gifts", "Charity"],
  },
  {
    name: "Financial",
    kind: "SPENDING",
    color: "#94A3B8",
    children: ["Bank Fees", "Interest", "Taxes", "Professional Services"],
  },
  {
    name: "Income",
    kind: "INCOME",
    color: "#00D68F",
    children: ["Salary", "Interest income", "Refunds", "Other income"],
  },
  {
    name: "Transfers",
    kind: "TRANSFER",
    color: "#64748B",
    children: ["Credit Card Payment", "Account Transfer", "ATM / Cash"],
  },
];

// ── DTOs ───────────────────────────────────────────────────────────

export interface HomeAccountDTO {
  id: string;
  name: string;
  type: HomeAccountType;
  last4: string | null;
  archivedAt: string | null;
}

export interface HomeCategoryDTO {
  id: string;
  name: string;
  parentId: string | null;
  kind: HomeCategoryKind;
  color: string | null;
  sortOrder: number;
  isSystem: boolean;
}

export interface HomeTransactionDTO {
  id: string;
  homeAccountId: string;
  date: string; // YYYY-MM-DD
  year: number;
  month: number;
  amount: number; // signed: negative = out, positive = in
  description: string;
  rawDescription: string;
  categoryId: string | null;
  propertyId: string | null;
  notes: string | null;
  isExcluded: boolean;
  excludeReason: string | null;
  needsReview: boolean;
  isManual: boolean;
}

/** A property the user can attribute Home expenses to. */
export interface PropertyOption {
  id: string;
  title: string;
}

/** A category with its children nested, for tree rendering / selects. */
export interface HomeCategoryTree extends HomeCategoryDTO {
  children: HomeCategoryDTO[];
}

/** Build a two-level tree from a flat category list (parents first, sorted). */
export function buildCategoryTree(cats: HomeCategoryDTO[]): HomeCategoryTree[] {
  const parents = cats
    .filter((c) => c.parentId === null)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
  const byParent = new Map<string, HomeCategoryDTO[]>();
  for (const c of cats) {
    if (c.parentId) {
      const arr = byParent.get(c.parentId) ?? [];
      arr.push(c);
      byParent.set(c.parentId, arr);
    }
  }
  return parents.map((p) => ({
    ...p,
    children: (byParent.get(p.id) ?? []).sort(
      (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)
    ),
  }));
}

/** Spend counts as a positive number: money out that isn't an excluded transfer. */
export function isSpend(t: { amount: number; isExcluded: boolean }): boolean {
  return !t.isExcluded && t.amount < 0;
}
export function isIncome(t: { amount: number; isExcluded: boolean }): boolean {
  return !t.isExcluded && t.amount > 0;
}
