// Hamo Properties — the property record: everything needed to manage a
// property beyond its ledger (facts, loans, insurance, tax, management,
// utilities, tax basis, maintenance, documents). Pure: zod schemas, DTO types
// and derived figures. No React, no Prisma; shared by API routes, the data
// layer, the detail page and the advisor.

import { z } from "zod";

/* ── Field primitives ────────────────────────────────────────────────── */

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Optional trimmed text; "" becomes null. */
const text = (max = 200) =>
  z
    .string()
    .max(max)
    .nullish()
    .transform((s) => (s == null || s.trim() === "" ? null : s.trim()));

/** Optional http(s) URL; "" becomes null. */
const url = z
  .string()
  .max(2000)
  .nullish()
  .transform((s) => (s == null || s.trim() === "" ? null : s.trim()))
  .refine((s) => s == null || /^https?:\/\/\S+$/i.test(s), { message: "Enter a full link starting with https://" });

/** Optional YYYY-MM-DD; "" becomes null. */
const date = z
  .string()
  .nullish()
  .transform((s) => (s == null || s.trim() === "" ? null : s.trim()))
  .refine((s) => s == null || DATE_RE.test(s), { message: "Use YYYY-MM-DD" });

// Selects post "" when left on the placeholder option; treat that as "not set".
const blank = (v: unknown) => (v === "" ? undefined : v);
const optEnum = <T extends readonly [string, ...string[]]>(values: T) =>
  z.preprocess(blank, z.enum(values).nullish()).transform((v) => v ?? null);
const defEnum = <T extends readonly [string, ...string[]]>(values: T, fallback: T[number]) =>
  z.preprocess(blank, z.enum(values).default(fallback as never));

const money = z.number().finite().nonnegative().nullish().transform((v) => v ?? null);
const num = z.number().finite().nullish().transform((v) => v ?? null);
const int = z.number().int().nonnegative().nullish().transform((v) => v ?? null);
const flag = z.boolean().nullish().transform((v) => v ?? null);

/* ── Single-value sections (Property.profile JSON) ───────────────────── */

export const PROPERTY_TYPES = ["sfh", "condo", "townhouse", "multi"] as const;
export const PROPERTY_TYPE_LABELS: Record<(typeof PROPERTY_TYPES)[number], string> = {
  sfh: "Single-family",
  condo: "Condo",
  townhouse: "Townhouse",
  multi: "Multi-unit",
};

export const factsSchema = z.object({
  propertyType: optEnum(PROPERTY_TYPES),
  beds: num,
  baths: num,
  sqft: int,
  lotSqft: int,
  yearBuilt: int,
  apn: text(80),
});

export const HOA_FREQUENCIES = ["monthly", "quarterly", "annual"] as const;
const HOA_PERIODS_PER_YEAR: Record<(typeof HOA_FREQUENCIES)[number], number> = { monthly: 12, quarterly: 4, annual: 1 };

export const hoaSchema = z.object({
  name: text(),
  /** Dues per billing period (key kept from when dues were monthly-only). */
  monthlyDues: money,
  frequency: defEnum(HOA_FREQUENCIES, "monthly"),
  /** Next due date, for quarterly / annual dues. */
  nextDueDate: date,
  /** Day of the month dues are due (1–31), for monthly dues. */
  dueDay: z.number().int().min(1).max(31).nullish().transform((v) => v ?? null),
  contact: text(),
  phone: text(40),
  email: text(),
  portalUrl: url,
});

export const insuranceSchema = z.object({
  carrier: text(),
  policyNumber: text(80),
  portalUrl: url,
  agentName: text(),
  agentPhone: text(40),
  agentEmail: text(),
  annualPremium: money,
  renewalDate: date,
  dwellingCoverage: money,
  liabilityCoverage: money,
  deductible: money,
  umbrella: flag,
  umbrellaCarrier: text(),
});

export const propertyTaxSchema = z.object({
  county: text(),
  accountNumber: text(80),
  portalUrl: url,
  assessedValue: money,
  assessedYear: int,
  annualTax: money,
  /** Installment due dates, YYYY-MM-DD. */
  dueDates: z.array(z.string().regex(DATE_RE)).max(12).nullish().transform((v) => v ?? null),
  lastAppealDate: date,
  nextAppealDeadline: date,
});

export const managementSchema = z.object({
  mode: optEnum(["self", "manager"] as const),
  company: text(),
  contact: text(),
  email: text(),
  phone: text(40),
  feeType: optEnum(["percent", "flat"] as const),
  /** Percent of rent collected, or a flat monthly amount. */
  feeValue: money,
  portalUrl: url,
});

export const DEFAULT_DEPRECIATION_METHOD = "27.5-year residential (straight line)";
export const RESIDENTIAL_RECOVERY_YEARS = 27.5;

export const taxBasisSchema = z.object({
  closingCosts: money,
  landValue: money,
  buildingValue: money,
  /** Where the land/building split came from, e.g. "County assessment ratio 2023". */
  allocationSource: text(),
  placedInService: date,
  method: text(),
  costSegStudy: flag,
  costSegNotes: text(500),
});

export const SYSTEM_KINDS = ["roof", "hvac", "water_heater", "appliances", "plumbing", "electrical", "other"] as const;
export const SYSTEM_LABELS: Record<(typeof SYSTEM_KINDS)[number], string> = {
  roof: "Roof",
  hvac: "HVAC",
  water_heater: "Water heater",
  appliances: "Appliances",
  plumbing: "Plumbing",
  electrical: "Electrical",
  other: "Other",
};

export const systemSchema = z.object({
  kind: z.enum(SYSTEM_KINDS),
  label: text(),
  installYear: int,
  warrantyEnd: date,
  lastService: date,
  notes: text(500),
});

export const systemsSchema = z.object({ items: z.array(systemSchema).max(30) });

export const PROFILE_SECTIONS = {
  facts: factsSchema,
  hoa: hoaSchema,
  insurance: insuranceSchema,
  tax: propertyTaxSchema,
  management: managementSchema,
  taxBasis: taxBasisSchema,
  systems: systemsSchema,
} as const;

export type ProfileSection = keyof typeof PROFILE_SECTIONS;
export const PROFILE_SECTION_KEYS = Object.keys(PROFILE_SECTIONS) as ProfileSection[];

export type PropertyFacts = z.output<typeof factsSchema>;
export type PropertyHoa = z.output<typeof hoaSchema>;
export type PropertyInsurance = z.output<typeof insuranceSchema>;
export type PropertyTaxInfo = z.output<typeof propertyTaxSchema>;
export type PropertyManagement = z.output<typeof managementSchema>;
export type PropertyTaxBasis = z.output<typeof taxBasisSchema>;
export type PropertySystem = z.output<typeof systemSchema>;

export interface PropertyProfile {
  facts?: PropertyFacts;
  hoa?: PropertyHoa;
  insurance?: PropertyInsurance;
  tax?: PropertyTaxInfo;
  management?: PropertyManagement;
  taxBasis?: PropertyTaxBasis;
  systems?: { items: PropertySystem[] };
}

/**
 * Read a stored profile defensively: each section is validated on its own, so
 * one bad section (older shape, hand edit) never hides the others.
 */
export function parseProfile(raw: unknown): PropertyProfile {
  const out: PropertyProfile = {};
  if (!raw || typeof raw !== "object") return out;
  const obj = raw as Record<string, unknown>;
  for (const key of PROFILE_SECTION_KEYS) {
    const parsed = PROFILE_SECTIONS[key].safeParse(obj[key]);
    if (parsed.success) (out as Record<string, unknown>)[key] = parsed.data;
  }
  return out;
}

/** True when a section has at least one filled field. */
export function sectionFilled(section: object | null | undefined): boolean {
  if (!section) return false;
  return Object.values(section).some((v) =>
    Array.isArray(v) ? v.length > 0 : v !== null && v !== undefined && v !== ""
  );
}

/* ── List records (own tables) ───────────────────────────────────────── */

export const LOAN_KINDS = ["first", "second", "heloc", "other"] as const;
export const LOAN_KIND_LABELS: Record<(typeof LOAN_KINDS)[number], string> = {
  first: "First mortgage",
  second: "Second mortgage",
  heloc: "HELOC",
  other: "Other loan",
};

export const loanInputSchema = z.object({
  kind: defEnum(LOAN_KINDS, "first"),
  lender: text(),
  servicer: text(),
  loanNumber: text(80),
  portalUrl: url,
  servicerPhone: text(40),
  originalAmount: money,
  startDate: date,
  termMonths: z.number().int().min(1).max(600).nullish().transform((v) => v ?? null),
  interestRate: z.number().finite().min(0).max(30).nullish().transform((v) => v ?? null),
  rateType: defEnum(["fixed", "arm"] as const, "fixed"),
  armResetDate: date,
  armIndex: text(60),
  armMargin: num,
  monthlyPI: money,
  escrowMonthly: money,
  pmiMonthly: money,
  pmiRemovalDate: date,
  maturityDate: date,
  balance: money,
  balanceAsOf: date,
  active: z.boolean().default(true),
  notes: text(1000),
});

export const IMPROVEMENT_CATEGORIES = ["improvement", "repair"] as const;
export const improvementInputSchema = z.object({
  date: z.string().regex(DATE_RE, "Date is required"),
  description: z.string().trim().min(1, "Describe the work").max(300),
  amount: z.number().finite().nonnegative(),
  category: defEnum(IMPROVEMENT_CATEGORIES, "improvement"),
  notes: text(1000),
});

export const maintenanceInputSchema = z.object({
  date: z.string().regex(DATE_RE, "Date is required"),
  vendor: text(),
  system: optEnum(SYSTEM_KINDS),
  cost: money,
  notes: text(1000),
  transactionId: text(60),
});

export const DOCUMENT_TYPES = ["deed", "closing", "lease", "insurance", "appraisal", "tax_bill", "hoa", "other"] as const;
export const DOCUMENT_TYPE_LABELS: Record<(typeof DOCUMENT_TYPES)[number], string> = {
  deed: "Deed",
  closing: "Closing statement",
  lease: "Lease",
  insurance: "Insurance declarations",
  appraisal: "Appraisal",
  tax_bill: "Tax bill",
  hoa: "HOA documents",
  other: "Other",
};

export const documentInputSchema = z.object({
  type: defEnum(DOCUMENT_TYPES, "other"),
  title: z.string().trim().min(1, "Give it a name").max(200),
  url: z
    .string()
    .trim()
    .regex(/^https?:\/\/\S+$/i, "Enter a full link starting with https://")
    .max(2000),
  date,
});

export const UTILITY_KINDS = ["electric", "gas", "water", "sewer", "trash", "internet"] as const;
export const UTILITY_LABELS: Record<(typeof UTILITY_KINDS)[number], string> = {
  electric: "Electric",
  gas: "Gas",
  water: "Water",
  sewer: "Sewer",
  trash: "Trash",
  internet: "Internet",
};

export const utilityInputSchema = z.object({
  kind: z.enum(UTILITY_KINDS),
  provider: text(),
  accountNumber: text(80),
  paidBy: defEnum(["tenant", "owner"] as const, "tenant"),
  portalUrl: url,
});

export const RECORD_LISTS = {
  loans: loanInputSchema,
  improvements: improvementInputSchema,
  maintenance: maintenanceInputSchema,
  documents: documentInputSchema,
  utilities: utilityInputSchema,
} as const;

export type RecordList = keyof typeof RECORD_LISTS;
export const RECORD_LIST_KEYS = Object.keys(RECORD_LISTS) as RecordList[];

type WithId<T> = T & { id: string };
export type PropertyLoanDTO = WithId<z.output<typeof loanInputSchema>>;
export type PropertyImprovementDTO = WithId<z.output<typeof improvementInputSchema>>;
export type PropertyMaintenanceDTO = WithId<z.output<typeof maintenanceInputSchema>>;
export type PropertyDocumentDTO = WithId<z.output<typeof documentInputSchema>>;
export type PropertyUtilityDTO = WithId<z.output<typeof utilityInputSchema>>;

/** Date fields per list, stored as timestamps and sent as YYYY-MM-DD. */
export const RECORD_DATE_FIELDS: Record<RecordList, string[]> = {
  loans: ["startDate", "armResetDate", "pmiRemovalDate", "maturityDate", "balanceAsOf"],
  improvements: ["date"],
  maintenance: ["date"],
  documents: ["date"],
  utilities: [],
};

/* ── Derived: loans ──────────────────────────────────────────────────── */

function parts(d: string): [number, number, number] {
  return [Number(d.slice(0, 4)), Number(d.slice(5, 7)), Number(d.slice(8, 10))];
}

/** Whole months from `from` to `to` (YYYY-MM-DD), floor, never negative. */
export function monthsBetween(from: string, to: string): number {
  const [y1, m1, d1] = parts(from);
  const [y2, m2, d2] = parts(to);
  const months = (y2 - y1) * 12 + (m2 - m1) - (d2 < d1 ? 1 : 0);
  return Math.max(0, months);
}

/** `date` plus `months` calendar months (day clamped). */
export function addMonths(date: string, months: number): string {
  const [y, m, d] = parts(date);
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, last));
  return target.toISOString().slice(0, 10);
}

/** Standard amortizing payment. */
export function amortizedPayment(principal: number, annualRatePct: number, months: number): number {
  if (months <= 0) return 0;
  const r = annualRatePct / 100 / 12;
  if (r === 0) return principal / months;
  return (principal * r) / (1 - Math.pow(1 + r, -months));
}

export interface LoanDerived {
  /** Maturity: as recorded, else start + term. */
  maturityDate: string | null;
  remainingMonths: number | null;
  /** P&I + escrow + PMI. */
  totalMonthlyPayment: number | null;
  /** Estimated interest paid this calendar year through `today`. */
  interestYtd: number | null;
}

/**
 * Figures shown next to a loan. Interest YTD is an estimate: it walks the
 * amortization schedule from the start date when the original amount, rate
 * and term are known, else applies the rate to the current balance.
 */
export function loanDerived(
  loan: Pick<
    PropertyLoanDTO,
    | "originalAmount"
    | "startDate"
    | "termMonths"
    | "interestRate"
    | "monthlyPI"
    | "escrowMonthly"
    | "pmiMonthly"
    | "maturityDate"
    | "balance"
  >,
  today: string
): LoanDerived {
  const maturityDate =
    loan.maturityDate ?? (loan.startDate && loan.termMonths ? addMonths(loan.startDate, loan.termMonths) : null);
  const remainingMonths = maturityDate ? (maturityDate > today ? monthsBetween(today, maturityDate) : 0) : null;
  const pieces = [loan.monthlyPI, loan.escrowMonthly, loan.pmiMonthly];
  const totalMonthlyPayment = pieces.some((v) => v != null) ? pieces.reduce<number>((s, v) => s + (v ?? 0), 0) : null;

  let interestYtd: number | null = null;
  const rate = loan.interestRate;
  const monthIndex = Number(today.slice(5, 7)); // payments made this year, one per month elapsed
  if (rate != null && loan.originalAmount && loan.startDate && loan.termMonths) {
    const r = rate / 100 / 12;
    const pay = loan.monthlyPI && loan.monthlyPI > 0 ? loan.monthlyPI : amortizedPayment(loan.originalAmount, rate, loan.termMonths);
    const yearStart = `${today.slice(0, 4)}-01-01`;
    const paidBeforeYear = loan.startDate < yearStart ? monthsBetween(loan.startDate, yearStart) : 0;
    const paidThrough = loan.startDate <= today ? monthsBetween(loan.startDate, today) : 0;
    let bal = loan.originalAmount;
    let interest = 0;
    for (let i = 0; i < Math.min(paidThrough, loan.termMonths) && bal > 0; i++) {
      const due = bal * r;
      if (i >= paidBeforeYear) interest += due;
      bal = Math.max(0, bal - (pay - due));
    }
    interestYtd = interest;
  } else if (rate != null && loan.balance != null) {
    interestYtd = (loan.balance * rate) / 100 / 12 * monthIndex;
  }
  return { maturityDate, remainingMonths, totalMonthlyPayment, interestYtd };
}

/**
 * The figure mirrored onto Property.mortgageBalance: the sum of the active
 * loans that carry a balance, as of the latest balance date. Null when no
 * active loan has a balance (the manual figure is then left alone).
 */
export function syncedMortgage(
  loans: Pick<PropertyLoanDTO, "active" | "balance" | "balanceAsOf">[]
): { balance: number; asOf: string | null } | null {
  const withBalance = loans.filter((l) => l.active && l.balance != null);
  if (withBalance.length === 0) return null;
  const balance = withBalance.reduce((s, l) => s + (l.balance ?? 0), 0);
  const dates = withBalance.map((l) => l.balanceAsOf).filter((d): d is string => Boolean(d)).sort();
  return { balance, asOf: dates.at(-1) ?? null };
}

/* ── Derived: tax basis ──────────────────────────────────────────────── */

export interface DepreciationSummary {
  /** Building value + closing costs allocated to the building + capital improvements. */
  depreciableBasis: number | null;
  annualDepreciation: number | null;
  improvementsTotal: number;
  repairsTotal: number;
}

/**
 * Straight-line residential depreciation. Closing costs are split between land
 * and building in the same ratio as the recorded values; land never
 * depreciates. Repairs are listed but expensed, so they stay out of the basis.
 */
export function depreciationSummary(
  basis: PropertyTaxBasis | undefined,
  improvements: Pick<PropertyImprovementDTO, "amount" | "category">[]
): DepreciationSummary {
  const improvementsTotal = improvements.filter((i) => i.category === "improvement").reduce((s, i) => s + i.amount, 0);
  const repairsTotal = improvements.filter((i) => i.category === "repair").reduce((s, i) => s + i.amount, 0);
  const building = basis?.buildingValue ?? null;
  if (building == null) {
    return { depreciableBasis: null, annualDepreciation: null, improvementsTotal, repairsTotal };
  }
  const land = basis?.landValue ?? 0;
  const share = building + land > 0 ? building / (building + land) : 1;
  const depreciableBasis = building + (basis?.closingCosts ?? 0) * share + improvementsTotal;
  return {
    depreciableBasis,
    annualDepreciation: depreciableBasis / RESIDENTIAL_RECOVERY_YEARS,
    improvementsTotal,
    repairsTotal,
  };
}

/* ── Key dates (feed "Needs attention") ──────────────────────────────── */

export type KeyDateKind =
  | "insurance-renewal"
  | "tax-due"
  | "arm-reset"
  | "pmi-removal"
  | "hoa-dues"
  | "warranty-end"
  | "appeal-deadline";

export interface KeyDate {
  kind: KeyDateKind;
  date: string;
  /** Short context, e.g. the carrier or the system. */
  label: string;
}

/** The next occurrence of day-of-month `day` on or after `today`. */
export function nextMonthlyDate(day: number, today: string): string {
  const [y, m, d] = parts(today);
  const clamp = (yy: number, mm: number) => {
    const last = new Date(Date.UTC(yy, mm, 0)).getUTCDate();
    return `${yy}-${String(mm).padStart(2, "0")}-${String(Math.min(day, last)).padStart(2, "0")}`;
  };
  const thisMonth = clamp(y, m);
  if (Math.min(day, new Date(Date.UTC(y, m, 0)).getUTCDate()) >= d) return thisMonth;
  return m === 12 ? clamp(y + 1, 1) : clamp(y, m + 1);
}

/** Step `date` forward by `months` until it is on or after `today`. */
function rollForward(date: string, months: number, today: string): string {
  const [y, m, d] = parts(date);
  let next = date;
  for (let k = 1; next < today && k < 400; k++) {
    const total = m - 1 + months * k;
    const yy = y + Math.floor(total / 12);
    const mm = (total % 12) + 1;
    const last = new Date(Date.UTC(yy, mm, 0)).getUTCDate();
    next = `${yy}-${String(mm).padStart(2, "0")}-${String(Math.min(d, last)).padStart(2, "0")}`;
  }
  return next;
}

/** HOA dues as a monthly amount, whatever the billing frequency. */
export function hoaMonthlyEquivalent(hoa: PropertyHoa | undefined): number | null {
  if (hoa?.monthlyDues == null) return null;
  return (hoa.monthlyDues * HOA_PERIODS_PER_YEAR[hoa.frequency ?? "monthly"]) / 12;
}

/** Every dated item in a property's record (the lookahead is applied later). */
export function keyDatesOf(
  profile: PropertyProfile,
  loans: Pick<PropertyLoanDTO, "kind" | "lender" | "active" | "rateType" | "armResetDate" | "pmiMonthly" | "pmiRemovalDate">[],
  today: string
): KeyDate[] {
  const out: KeyDate[] = [];
  const ins = profile.insurance;
  if (ins?.renewalDate) out.push({ kind: "insurance-renewal", date: ins.renewalDate, label: ins.carrier ?? "Insurance" });
  for (const d of profile.tax?.dueDates ?? []) {
    out.push({ kind: "tax-due", date: d, label: profile.tax?.county ? `${profile.tax.county} property tax` : "Property tax" });
  }
  if (profile.tax?.nextAppealDeadline) {
    out.push({ kind: "appeal-deadline", date: profile.tax.nextAppealDeadline, label: "Assessment appeal" });
  }
  const hoa = profile.hoa;
  if (hoa?.monthlyDues) {
    const label = hoa.name ?? "HOA dues";
    const frequency = hoa.frequency ?? "monthly"; // records saved before frequency existed
    if (frequency === "monthly" && hoa.dueDay) {
      out.push({ kind: "hoa-dues", date: nextMonthlyDate(hoa.dueDay, today), label });
    } else if (frequency !== "monthly" && hoa.nextDueDate) {
      out.push({ kind: "hoa-dues", date: rollForward(hoa.nextDueDate, 12 / HOA_PERIODS_PER_YEAR[frequency], today), label });
    }
  }
  for (const s of profile.systems?.items ?? []) {
    if (s.warrantyEnd) {
      out.push({ kind: "warranty-end", date: s.warrantyEnd, label: s.label ?? SYSTEM_LABELS[s.kind] });
    }
  }
  for (const l of loans) {
    if (!l.active) continue;
    const name = l.lender ?? LOAN_KIND_LABELS[l.kind];
    if (l.rateType === "arm" && l.armResetDate) out.push({ kind: "arm-reset", date: l.armResetDate, label: name });
    if (l.pmiMonthly && l.pmiRemovalDate) out.push({ kind: "pmi-removal", date: l.pmiRemovalDate, label: name });
  }
  return out;
}

/* ── The full record and its summary ─────────────────────────────────── */

export interface PropertyRecord {
  profile: PropertyProfile;
  loans: PropertyLoanDTO[];
  improvements: PropertyImprovementDTO[];
  maintenance: PropertyMaintenanceDTO[];
  documents: PropertyDocumentDTO[];
  utilities: PropertyUtilityDTO[];
}

export const EMPTY_RECORD: PropertyRecord = {
  profile: {},
  loans: [],
  improvements: [],
  maintenance: [],
  documents: [],
  utilities: [],
};

/** Per-property facts the advisor reads for tax / profit / revenue recommendations. */
export interface PropertyRecordSummary {
  loans: {
    count: number;
    /** Sum of active balances. */
    totalBalance: number | null;
    /** Balance-weighted annual rate (percent) over active loans with both figures. */
    weightedRatePct: number | null;
    monthlyPI: number | null;
    monthlyEscrow: number | null;
    totalMonthlyPayment: number | null;
    /** Estimated interest paid this calendar year (Schedule E line 12 cross-check). */
    interestYtd: number | null;
    hasArm: boolean;
    nextArmReset: string | null;
    hasPmi: boolean;
  };
  insurance: { carrier: string | null; annualPremium: number | null; renewalDate: string | null; umbrella: boolean | null } | null;
  tax: { annualTax: number | null; assessedValue: number | null; assessedYear: number | null; nextDueDate: string | null; nextAppealDeadline: string | null } | null;
  management: { mode: "self" | "manager" | null; feeType: "percent" | "flat" | null; feeValue: number | null; company: string | null } | null;
  hoaMonthlyDues: number | null;
  depreciation: DepreciationSummary;
  /** Every dated item in the record, sorted. */
  keyDates: KeyDate[];
}

const sumOrNull = (vals: (number | null)[]) =>
  vals.some((v) => v != null) ? vals.reduce<number>((s, v) => s + (v ?? 0), 0) : null;

export function summarizeRecord(record: PropertyRecord, today: string): PropertyRecordSummary {
  const active = record.loans.filter((l) => l.active);
  const derived = active.map((l) => loanDerived(l, today));
  const rated = active.filter((l) => l.balance != null && l.balance > 0 && l.interestRate != null);
  const ratedBalance = rated.reduce((s, l) => s + (l.balance ?? 0), 0);
  const p = record.profile;
  const arms = active.filter((l) => l.rateType === "arm" && l.armResetDate).map((l) => l.armResetDate!).sort();
  const futureDue = (p.tax?.dueDates ?? []).filter((d) => d >= today).sort();
  return {
    loans: {
      count: active.length,
      totalBalance: sumOrNull(active.map((l) => l.balance)),
      weightedRatePct:
        ratedBalance > 0 ? rated.reduce((s, l) => s + (l.balance ?? 0) * (l.interestRate ?? 0), 0) / ratedBalance : null,
      monthlyPI: sumOrNull(active.map((l) => l.monthlyPI)),
      monthlyEscrow: sumOrNull(active.map((l) => l.escrowMonthly)),
      totalMonthlyPayment: sumOrNull(derived.map((d) => d.totalMonthlyPayment)),
      interestYtd: sumOrNull(derived.map((d) => d.interestYtd)),
      hasArm: active.some((l) => l.rateType === "arm"),
      nextArmReset: arms.find((d) => d >= today) ?? null,
      hasPmi: active.some((l) => (l.pmiMonthly ?? 0) > 0),
    },
    insurance: sectionFilled(p.insurance)
      ? {
          carrier: p.insurance!.carrier,
          annualPremium: p.insurance!.annualPremium,
          renewalDate: p.insurance!.renewalDate,
          umbrella: p.insurance!.umbrella,
        }
      : null,
    tax: sectionFilled(p.tax)
      ? {
          annualTax: p.tax!.annualTax,
          assessedValue: p.tax!.assessedValue,
          assessedYear: p.tax!.assessedYear,
          nextDueDate: futureDue[0] ?? null,
          nextAppealDeadline: p.tax!.nextAppealDeadline,
        }
      : null,
    management: sectionFilled(p.management)
      ? { mode: p.management!.mode, feeType: p.management!.feeType, feeValue: p.management!.feeValue, company: p.management!.company }
      : null,
    hoaMonthlyDues: hoaMonthlyEquivalent(p.hoa),
    depreciation: depreciationSummary(p.taxBasis, record.improvements),
    keyDates: keyDatesOf(p, record.loans, today).sort((a, b) => a.date.localeCompare(b.date)),
  };
}
