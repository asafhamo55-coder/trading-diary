// Per-property facts for the advisor's real-estate review: rent, leases,
// vacancy, income/expenses by Schedule E category for this year and last,
// derived metrics (NOI, cap rate, cash-on-cash, expense ratio, 1% rule,
// cost shares of rent) and tax-relevant facts. Pure — fed by
// property-data.ts getProperties(), unit-tested with synthetic data.
import { EXPENSE_CATEGORIES, forReturns, isCurrentTenant, propertyTitle } from "./property";
import type { PropertyDTO, PropertyTransactionDTO, TenantDTO } from "./property";

/** Same shape as property-data.ts PropertyWithTx. */
export type PropertyWithTx = PropertyDTO & { transactions: PropertyTransactionDTO[]; tenants: TenantDTO[] };

/** Not operating expenses: excluded from NOI. */
const NON_OPERATING = new Set(["MORTGAGE_INTEREST", "DEPRECIATION"]);

const round = (v: number) => Math.round(v);
const pct = (num: number, den: number | null | undefined): number | null =>
  den && den > 0 ? Math.round((num / den) * 1000) / 10 : null;

/**
 * Optional full property record (loans, insurance, property tax, management,
 * basis, improvements) from property-data.ts `getPropertyRecord(id)` once that
 * lands. Every field is optional and passed through as-is so the advisor can
 * run the refinance / PMI / insurance re-shop / tax appeal / management-fee /
 * depreciation-basis checks. Coded defensively: absent → null in the review.
 */
export interface PropertyRecordFacts {
  loans?: { lender?: string | null; balance?: number | null; ratePct?: number | null; type?: "fixed" | "arm" | string | null; monthlyPayment?: number | null; escrowMonthly?: number | null; pmiMonthly?: number | null; originationDate?: string | null; termYears?: number | null }[];
  insurance?: { carrier?: string | null; annualPremium?: number | null; renewalDate?: string | null; dwellingCoverage?: number | null; liabilityCoverage?: number | null } | null;
  propertyTax?: { assessedValue?: number | null; annualTax?: number | null; appealDeadline?: string | null; exemptions?: string[] | null } | null;
  management?: { company?: string | null; feePct?: number | null; leasingFee?: number | null } | null;
  basis?: { landValue?: number | null; buildingValue?: number | null; placedInServiceDate?: string | null } | null;
  improvements?: { date?: string | null; description?: string | null; amount?: number | null }[];
  maintenance?: { date?: string | null; description?: string | null; amount?: number | null }[];
  [key: string]: unknown;
}

export interface YearFinancials {
  year: number;
  /** Months of the year covered (12 for past years; elapsed months this year). */
  months: number;
  incomeByCategory: Record<string, number>;
  expensesByCategory: Record<string, number>;
  rentIncome: number;
  totalIncome: number;
  operatingExpenses: number;
  mortgageInterest: number;
  depreciation: number;
  noi: number;
  /** Income − all cash expenses (principal payments are not tracked). */
  cashFlowBeforePrincipal: number;
  expenseRatioPct: number | null;
  shareOfRentPct: { propertyTax: number | null; insurance: number | null; repairs: number | null; management: number | null };
  vacancyMonths: number | null;
}

export interface RentalReview {
  id: string;
  title: string;
  address: string;
  street: string | null;
  unit: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  /** Units sharing street/city/zip share a buildingKey. */
  buildingKey: string;
  unitsInBuilding: number;
  purchasePrice: number | null;
  purchaseDate: string | null;
  downPayment: number | null;
  currentValue: number | null;
  valueAsOf: string | null;
  mortgageBalance: number | null;
  mortgageAsOf: string | null;
  equity: number | null;
  currentRentMonthly: number | null;
  lease: { start: string | null; end: string | null; monthsToEnd: number | null; tenantCount: number };
  thisYear: YearFinancials;
  lastYear: YearFinancials;
  metrics: {
    /** Annual figures from last year if it has data, else this year annualized. */
    basis: "lastYear" | "thisYearAnnualized" | "none";
    noiAnnual: number | null;
    capRateOnValuePct: number | null;
    cashOnCashPct: number | null;
    expenseRatioPct: number | null;
    /** Monthly rent ÷ value; the "1% rule" target is ≥ 1%. */
    rentToValueMonthlyPct: number | null;
  };
  tax: {
    landValue: number | null;
    landVsBuildingKnown: boolean;
    depreciationStartYear: number | null;
    depreciationRecordedLastYear: boolean;
    yearsHeld: number | null;
    costSegregationCandidate: boolean | null;
    passiveLossStatus: "unknown";
    notes: string[];
  };
  /** Full record when available (see PropertyRecordFacts), else null. */
  record: PropertyRecordFacts | null;
  dataGaps: string[];
}

export interface ResidenceReview {
  id: string;
  title: string;
  currentValue: number | null;
  valueAsOf: string | null;
  mortgageBalance: number | null;
  equity: number | null;
}

export interface RealEstateReview {
  rentals: RentalReview[];
  residence: ResidenceReview[];
  questions: string[];
}

const ymd = (d: Date) => d.toISOString().slice(0, 10);

function monthsBetween(fromIso: string, to: Date): number {
  const [y, m] = fromIso.split("-").map(Number);
  return (to.getUTCFullYear() - y) * 12 + (to.getUTCMonth() + 1 - m);
}

/** Months in `year` (1..monthsCovered) with no lease covering any day of the month. */
export function vacancyMonths(tenants: TenantDTO[], year: number, monthsCovered: number): number | null {
  if (tenants.length === 0) return null;
  let vacant = 0;
  for (let m = 1; m <= monthsCovered; m++) {
    const start = `${year}-${String(m).padStart(2, "0")}-01`;
    const end = `${year}-${String(m).padStart(2, "0")}-31`;
    const covered = tenants.some((t) => t.leaseStart <= end && (t.leaseEnd === null || t.leaseEnd >= start));
    if (!covered) vacant++;
  }
  return vacant;
}

export function yearFinancials(txs: PropertyTransactionDTO[], tenants: TenantDTO[], year: number, months: number): YearFinancials {
  const rows = forReturns(txs).filter((t) => t.year === year);
  const incomeByCategory: Record<string, number> = {};
  const expensesByCategory: Record<string, number> = {};
  for (const t of rows) {
    const bucket = t.type === "INCOME" ? incomeByCategory : expensesByCategory;
    bucket[t.category] = round((bucket[t.category] ?? 0) + t.amount);
  }
  // Depreciation is often a tax-only entry: read it from the unfiltered list.
  const depreciation = round(txs.filter((t) => t.year === year && t.category === "DEPRECIATION").reduce((s, t) => s + t.amount, 0));
  const totalIncome = Object.values(incomeByCategory).reduce((s, v) => s + v, 0);
  const rentIncome = incomeByCategory.RENT ?? 0;
  const operatingExpenses = Object.entries(expensesByCategory)
    .filter(([k]) => !NON_OPERATING.has(k))
    .reduce((s, [, v]) => s + v, 0);
  const mortgageInterest = expensesByCategory.MORTGAGE_INTEREST ?? 0;
  const noi = totalIncome - operatingExpenses;
  const share = (keys: string[]) => pct(keys.reduce((s, k) => s + (expensesByCategory[k] ?? 0), 0), rentIncome);
  return {
    year,
    months,
    incomeByCategory,
    expensesByCategory,
    rentIncome,
    totalIncome,
    operatingExpenses,
    mortgageInterest,
    depreciation,
    noi,
    cashFlowBeforePrincipal: noi - mortgageInterest,
    expenseRatioPct: pct(operatingExpenses, totalIncome),
    shareOfRentPct: {
      propertyTax: share(["PROPERTY_TAX"]),
      insurance: share(["INSURANCE"]),
      repairs: share(["REPAIRS", "CLEANING_MAINT"]),
      management: share(["MANAGEMENT"]),
    },
    vacancyMonths: vacancyMonths(tenants, year, months),
  };
}

const buildingKeyOf = (p: { street: string | null; city: string | null; zip: string | null; address: string }) =>
  [p.street, p.city, p.zip]
    .map((s) => (s ?? "").trim().toLowerCase())
    .join("|")
    .replace(/^\|\|$/, p.address.trim().toLowerCase());

/** Cost segregation is usually worth pricing once the depreciable basis is ≥ ~$500K. */
const COST_SEG_BASIS_USD = 500_000;

export function buildRealEstateReview(
  properties: PropertyWithTx[],
  asOf: Date,
  records: Record<string, PropertyRecordFacts | null | undefined> = {}
): RealEstateReview {
  const active = properties.filter((p) => !p.archivedAt);
  const rentalsIn = active.filter((p) => p.usage !== "residence");
  const year = asOf.getUTCFullYear();
  const monthsThisYear = asOf.getUTCMonth() + 1;
  const today = ymd(asOf);
  const buildingCounts = new Map<string, number>();
  for (const p of rentalsIn) buildingCounts.set(buildingKeyOf(p), (buildingCounts.get(buildingKeyOf(p)) ?? 0) + 1);

  const rentals = rentalsIn.map((p): RentalReview => {
    const current = p.tenants.filter((t) => isCurrentTenant(t, today)).sort((a, b) => b.leaseStart.localeCompare(a.leaseStart))[0] ?? null;
    const thisYear = yearFinancials(p.transactions, p.tenants, year, monthsThisYear);
    const lastYear = yearFinancials(p.transactions, p.tenants, year - 1, 12);
    const basis = lastYear.totalIncome > 0 ? "lastYear" : thisYear.totalIncome > 0 ? "thisYearAnnualized" : "none";
    const annualize = (v: number) => (basis === "lastYear" ? v : round((v * 12) / monthsThisYear));
    const src = basis === "lastYear" ? lastYear : thisYear;
    const noiAnnual = basis === "none" ? null : annualize(src.noi);
    const cashFlowAnnual = basis === "none" ? null : annualize(src.cashFlowBeforePrincipal);
    const purchaseYear = p.purchaseDate ? Number(p.purchaseDate.slice(0, 4)) : null;
    const gaps: string[] = [];
    if (p.currentValue == null) gaps.push("Current value missing.");
    if (p.purchasePrice == null) gaps.push("Purchase price missing (needed for depreciation basis).");
    if (p.downPayment == null) gaps.push("Down payment missing (needed for cash-on-cash).");
    if (p.mortgageBalance == null) gaps.push("Mortgage balance/rate missing (needed for the refinance check).");
    if (!current) gaps.push("No current tenant/lease recorded.");
    if (p.tenants.length === 0) gaps.push("No lease history — vacancy can't be computed.");
    const record = records[p.id] ?? null;
    const land = record?.basis?.landValue ?? null;
    if (land == null) gaps.push("Land vs building split unknown (drives the depreciation basis).");
    const depRecorded = lastYear.depreciation > 0;
    const notes: string[] = [];
    if (!depRecorded) notes.push(`No DEPRECIATION entry recorded for ${year - 1}.`);
    return {
      id: p.id,
      title: propertyTitle(p),
      address: p.address,
      street: p.street,
      unit: p.unit,
      city: p.city,
      state: p.state,
      zip: p.zip,
      buildingKey: buildingKeyOf(p),
      unitsInBuilding: buildingCounts.get(buildingKeyOf(p)) ?? 1,
      purchasePrice: p.purchasePrice,
      purchaseDate: p.purchaseDate,
      downPayment: p.downPayment,
      currentValue: p.currentValue,
      valueAsOf: p.valueAsOf,
      mortgageBalance: p.mortgageBalance,
      mortgageAsOf: p.mortgageAsOf,
      equity: p.currentValue != null ? round(p.currentValue - (p.mortgageBalance ?? 0)) : null,
      currentRentMonthly: current?.monthlyRent ?? null,
      lease: {
        start: current?.leaseStart ?? null,
        end: current?.leaseEnd ?? null,
        monthsToEnd: current?.leaseEnd ? -monthsBetween(current.leaseEnd, asOf) : null,
        tenantCount: p.tenants.length,
      },
      thisYear,
      lastYear,
      metrics: {
        basis,
        noiAnnual,
        capRateOnValuePct: noiAnnual != null ? pct(noiAnnual, p.currentValue) : null,
        cashOnCashPct: cashFlowAnnual != null ? pct(cashFlowAnnual, p.downPayment) : null,
        expenseRatioPct: src.expenseRatioPct,
        rentToValueMonthlyPct: current?.monthlyRent != null ? pct(current.monthlyRent, p.currentValue) : null,
      },
      tax: {
        landValue: land,
        landVsBuildingKnown: land != null,
        depreciationStartYear: purchaseYear,
        depreciationRecordedLastYear: depRecorded,
        yearsHeld: purchaseYear != null ? year - purchaseYear : null,
        costSegregationCandidate: p.purchasePrice != null ? p.purchasePrice >= COST_SEG_BASIS_USD : null,
        passiveLossStatus: "unknown",
        notes,
      },
      record,
      dataGaps: gaps,
    };
  });

  const residence = active
    .filter((p) => p.usage === "residence")
    .map((p) => ({
      id: p.id,
      title: propertyTitle(p),
      currentValue: p.currentValue,
      valueAsOf: p.valueAsOf,
      mortgageBalance: p.mortgageBalance,
      equity: p.currentValue != null ? round(p.currentValue - (p.mortgageBalance ?? 0)) : null,
    }));

  const questions =
    rentals.length > 0
      ? [
          "Household modified AGI (for the $25K passive-loss allowance phase-out) and whether either adult could qualify as a real-estate professional.",
          "Land vs building value for each rental (county assessor split or appraisal) — drives depreciation.",
          "Current mortgage rate and term for each financed rental — needed for the refinance check.",
        ]
      : [];

  return { rentals, residence, questions };
}

/** Expense categories in display order (for anyone rendering the review). */
export const REVIEW_EXPENSE_KEYS = EXPENSE_CATEGORIES.map((c) => c.key);

// Keys never sent to the advisor model: account/loan/policy numbers and portal
// links. Emails reference accounts through {{account:<id>}} placeholders instead.
const PRIVATE_KEY = /(number|url|portal|phone|email)$/i;

function stripPrivate(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(stripPrivate);
  if (v && typeof v === "object") {
    return Object.fromEntries(
      Object.entries(v as Record<string, unknown>)
        .filter(([k]) => !PRIVATE_KEY.test(k))
        .map(([k, val]) => [k, stripPrivate(val)])
    );
  }
  return v;
}

/**
 * Adapt property-data's full record (+ its derived summary) to the advisor's
 * PropertyRecordFacts: the basis is lifted to the shape the review reads, and
 * the rest is passed through with numbers/links removed.
 */
export function recordFactsFrom(
  record: { profile: Record<string, unknown>; loans: unknown[]; improvements: unknown[]; maintenance: unknown[] },
  summary?: unknown
): PropertyRecordFacts {
  const basis = (record.profile.taxBasis ?? null) as
    | { landValue?: number | null; buildingValue?: number | null; placedInService?: string | null }
    | null;
  return stripPrivate({
    summary: summary ?? null,
    basis: basis ? { landValue: basis.landValue ?? null, buildingValue: basis.buildingValue ?? null, placedInServiceDate: basis.placedInService ?? null } : null,
    insurance: record.profile.insurance ?? null,
    propertyTax: record.profile.propertyTax ?? record.profile.tax ?? null,
    management: record.profile.management ?? null,
    facts: record.profile.facts ?? null,
    hoa: record.profile.hoa ?? null,
    loans: record.loans,
    improvements: record.improvements,
    maintenance: record.maintenance,
  }) as PropertyRecordFacts;
}
