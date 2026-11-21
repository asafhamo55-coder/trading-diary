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
  /** Counted for tax, ignored by every performance figure. See `forReturns`. */
  taxOnly: boolean;
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
  downPayment: number | null;
  purchaseDate: string | null;
  currentValue: number | null;
  valueAsOf: string | null;
  mortgageBalance: number | null;
  mortgageAsOf: string | null;
  notes: string | null;
  archivedAt: string | null;
}

export interface AppreciationStats {
  gain: number;
  totalPct: number;
  years: number;
  annualizedPct: number;
  returnOnDownPct: number | null;
}

/** Appreciation from purchase price to the current value/Zestimate. */
export function computeAppreciation(p: {
  purchasePrice: number | null;
  purchaseDate: string | null;
  currentValue: number | null;
  valueAsOf: string | null;
  downPayment: number | null;
}): AppreciationStats | null {
  if (!p.purchasePrice || p.purchasePrice <= 0 || p.currentValue == null) return null;
  const gain = p.currentValue - p.purchasePrice;
  const totalPct = gain / p.purchasePrice;
  const start = p.purchaseDate ? new Date(p.purchaseDate).getTime() : NaN;
  const end = p.valueAsOf ? new Date(p.valueAsOf).getTime() : Date.now();
  const years = Number.isNaN(start)
    ? 0
    : Math.max(0, (end - start) / (365.25 * 24 * 3600 * 1000));
  const annualizedPct =
    years > 0 ? Math.pow(p.currentValue / p.purchasePrice, 1 / years) - 1 : totalPct;
  const returnOnDownPct = p.downPayment && p.downPayment > 0 ? gain / p.downPayment : null;
  return { gain, totalPct, years, annualizedPct, returnOnDownPct };
}

/** Standard seller selling-cost assumptions (as a fraction of sale price). */
export const REALTOR_PCT = 0.06;
export const CLOSING_PCT = 0.02; // title, escrow, transfer/recording, etc.

export interface SaleScenario {
  realtorPct: number;
  closingPct: number;
  realtorCost: number;
  closingCost: number;
  sellingCosts: number;
  netProceeds: number; // after realtor + closing costs
  netProfit: number; // netProceeds − purchase price
  netProfitPct: number; // netProfit / purchase price
  cashOnCash: number | null; // netProfit / down payment
}

/**
 * "If sold today" net after standard selling costs (6% realtor + ~2% closing),
 * and the resulting cash-on-cash return on the down payment.
 */
export function computeSaleScenario(
  p: {
    purchasePrice: number | null;
    currentValue: number | null;
    downPayment: number | null;
  },
  realtorPct: number = REALTOR_PCT,
  closingPct: number = CLOSING_PCT
): SaleScenario | null {
  if (!p.currentValue || p.currentValue <= 0) return null;
  const realtorCost = p.currentValue * realtorPct;
  const closingCost = p.currentValue * closingPct;
  const sellingCosts = realtorCost + closingCost;
  const netProceeds = p.currentValue - sellingCosts;
  const basis = p.purchasePrice ?? 0;
  const netProfit = netProceeds - basis;
  const netProfitPct = basis > 0 ? netProfit / basis : 0;
  const cashOnCash = p.downPayment && p.downPayment > 0 ? netProfit / p.downPayment : null;
  return {
    realtorPct,
    closingPct,
    realtorCost,
    closingCost,
    sellingCosts,
    netProceeds,
    netProfit,
    netProfitPct,
    cashOnCash,
  };
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

/**
 * The entries that count toward how the property performed. `taxOnly` entries
 * belong on the tax report but not in net / yield / cash-on-cash / cash-flow,
 * so every performance figure filters through here while the tax summary reads
 * the unfiltered list. One summarizer, two inputs — the definitions can't drift.
 */
export function forReturns<T extends { taxOnly?: boolean }>(transactions: T[]): T[] {
  return transactions.filter((t) => !t.taxOnly);
}

/** How many of these entries are marked tax-only. */
export function taxOnlyCount(transactions: { taxOnly?: boolean }[]): number {
  return transactions.reduce((n, t) => n + (t.taxOnly ? 1 : 0), 0);
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
    // Month m of `year` counts as occupied if any lease overlaps it. The month
    // end must be its real last day: pinning it to the 28th dropped the first
    // month of any lease starting on the 29th–31st, while still counting the
    // last month of one ending then — an asymmetry that understated occupancy.
    const mm = String(m).padStart(2, "0");
    const lastDay = new Date(Date.UTC(year, m, 0)).getUTCDate();
    const monthStart = `${year}-${mm}-01`;
    const monthEnd = `${year}-${mm}-${lastDay}`;
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

// Words that introduce a unit designator inside an address.
const UNIT_WORDS = "unit|apt|apartment|ste|suite|bldg|building|fl|floor|rm|room";
// The identifier that must follow one of those words for it to really be a unit:
// something containing a digit ("2", "4B", "A-1") or a lone letter ("B").
// Without this, a street named "7 Bldg Way" would lose its name.
const UNIT_ID = "(?:[A-Za-z0-9-]*[0-9][A-Za-z0-9-]*|[A-Za-z])";
// A whole address segment that names a unit rather than the building.
const UNIT_SEGMENT_RE = new RegExp(
  `^(?:#\\s*\\S+|(?:${UNIT_WORDS})\\s*\\.?\\s*${UNIT_ID})$`,
  "i"
);
// The same, appended to a street line: "1053 Laurel Ct NW #2".
const TRAILING_UNIT_RE = new RegExp(
  `[\\s,]+(?:#\\s*\\S+|(?:${UNIT_WORDS})\\s*\\.?\\s*${UNIT_ID})\\s*$`,
  "i"
);
const ZIP_RE = /^\d{5}(?:-\d{4})?$/;
const STATE_RE = /^[A-Za-z]{2}$/;

function normalizePart(v?: string | null): string {
  return (v ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Key identifying the physical building a property sits in, so the units of a
 * multi-unit address group together.
 *
 * Both sources of address data reduce to the SAME canonical shape —
 * `street|state|zip` — because a property may carry structured parts (once its
 * address has been edited in the UI) or only the single `address` string it was
 * imported with, and the two units of one building can differ in which. Keying
 * each format differently would silently split a building in half.
 *
 * City is deliberately left out: a street plus state plus ZIP already pins a
 * building, and ZIP position inside a free-form address is not reliable. When
 * neither state nor ZIP is recorded, the remaining address detail is folded in
 * so two same-named streets in different towns still stay apart. Properties
 * with no address at all fall back to their own id and never group.
 */
export function buildingKey(p: {
  id: string;
  street?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  address?: string | null;
}): string {
  const structuredStreet = (p.street ?? "").trim();
  let street: string;
  let state = normalizePart(p.state);
  let zip = normalizePart(p.zip);
  let extra = "";

  if (structuredStreet) {
    street = normalizePart(structuredStreet.replace(TRAILING_UNIT_RE, ""));
    if (!state && !zip) extra = normalizePart(p.city);
  } else {
    const segments = (p.address ?? "")
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
    const kept = segments.filter((v) => !UNIT_SEGMENT_RE.test(v));
    street = normalizePart(kept[0] ?? "");
    if (!zip) zip = normalizePart(segments.find((v) => ZIP_RE.test(v)) ?? "");
    if (!state) state = normalizePart(segments.find((v) => STATE_RE.test(v)) ?? "");
    if (!state && !zip) extra = kept.slice(1).map(normalizePart).join(" ");
  }

  return [street, state, zip, extra].filter(Boolean).join("|") || p.id;
}

/** Cash returned over the period as a percentage of the cash invested. */
export function cashOnCashPct(net: number, downPayment: number | null): number | null {
  if (!downPayment || downPayment <= 0) return null;
  return (net / downPayment) * 100;
}

export interface BuildingCash {
  /** Net (income − expenses) summed across every unit of the building. */
  net: number;
  /** Down payments summed across every unit — the cash that bought it. */
  downPayment: number;
  unitCount: number;
  cashOnCashPct: number | null;
}

/**
 * Roll each property's year net and down payment up to its building, so the
 * units of a multi-unit address report one combined return on the cash that
 * bought the building. Down payments are summed rather than read off a single
 * unit, which stays correct whether the cash is recorded on one unit or split
 * across several. Returns the building's stats keyed by property id, so every
 * unit of a building reads the same figure.
 */
export function buildingCashByProperty(
  properties: {
    id: string;
    street?: string | null;
    city?: string | null;
    state?: string | null;
    zip?: string | null;
    address?: string | null;
    downPayment: number | null;
    net: number;
  }[]
): Map<string, BuildingCash> {
  const groups = new Map<
    string,
    { net: number; downPayment: number; ids: string[] }
  >();
  for (const p of properties) {
    const key = buildingKey(p);
    const g = groups.get(key) ?? { net: 0, downPayment: 0, ids: [] };
    g.net += p.net;
    g.downPayment += p.downPayment ?? 0;
    g.ids.push(p.id);
    groups.set(key, g);
  }

  const byProperty = new Map<string, BuildingCash>();
  for (const g of groups.values()) {
    const stats: BuildingCash = {
      net: g.net,
      downPayment: g.downPayment,
      unitCount: g.ids.length,
      cashOnCashPct: cashOnCashPct(g.net, g.downPayment),
    };
    for (const id of g.ids) byProperty.set(id, stats);
  }
  return byProperty;
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
  const types = new Map<string, PropertyTxType>();
  for (const t of rows) {
    if (t.type === "INCOME") income += t.amount;
    else expenses += t.amount;
    totals.set(t.category, (totals.get(t.category) ?? 0) + t.amount);
    types.set(t.category, t.type);
  }
  // Preserve the catalog order for a stable, tax-form-like layout.
  const byCategory = PROPERTY_CATEGORIES.filter((c) => totals.has(c.key)).map((c) => ({
    key: c.key,
    label: c.label,
    type: c.type,
    total: totals.get(c.key) ?? 0,
  }));
  // A category outside the catalog (stale data, a renamed key) still moves the
  // totals, so it has to appear in the breakdown too — otherwise the tax lines
  // silently fail to sum to the net printed beneath them. Listed after the
  // catalog rows, in a stable order.
  for (const key of [...totals.keys()].filter((k) => !CATEGORY_BY_KEY.has(k)).sort()) {
    byCategory.push({
      key,
      label: categoryLabel(key),
      type: types.get(key) ?? "EXPENSE",
      total: totals.get(key) ?? 0,
    });
  }
  return { income, expenses, net: income - expenses, byCategory };
}


/**
 * Building-level cash stats for a year, keyed by property id — the one
 * definition behind the cash-on-cash figure on both the properties list and a
 * property's detail page. Archived properties are dropped before the rollup
 * (they are out of the portfolio, so neither their net nor their down payment
 * should move it), and tax-only entries are filtered out like every other
 * performance figure.
 */
export function buildingCashForYear(
  properties: {
    id: string;
    street?: string | null;
    city?: string | null;
    state?: string | null;
    zip?: string | null;
    address?: string | null;
    downPayment: number | null;
    archivedAt?: string | null;
    transactions: {
      year: number;
      type: PropertyTxType;
      category: string;
      amount: number;
      taxOnly?: boolean;
    }[];
  }[],
  year: number
): Map<string, BuildingCash> {
  return buildingCashByProperty(
    properties
      .filter((p) => !p.archivedAt)
      .map((p) => ({
        id: p.id,
        street: p.street,
        city: p.city,
        state: p.state,
        zip: p.zip,
        address: p.address,
        downPayment: p.downPayment,
        net: summarizeYear(forReturns(p.transactions), year).net,
      }))
  );
}
