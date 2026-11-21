// Hamo Savings / Net Worth — pure domain logic (no Prisma, no Next).
// Everything here is unit-tested in tests/lib/savings.test.ts.
// Use relative imports only so vitest can load it without path aliases.

// ── Enumerations ───────────────────────────────────────────────────

export const IL_SAVINGS_TYPES = [
  "pension", // קרן פנסיה
  "managers_insurance", // ביטוח מנהלים
  "hishtalmut", // קרן השתלמות
  "gemel", // קופת גמל
  "gemel_investment", // קופת גמל להשקעה
  "savings_policy", // פוליסת חיסכון
  "savings_child", // חיסכון לכל ילד
] as const;
/**
 * "rsu" = employer equity compensation (RSUs / stock-plan account). Its
 * `balance` is the value of vested-and-held shares only; unvested grants
 * and the vest schedule live in `details` and are not counted in net worth.
 */
export const US_SAVINGS_TYPES = ["401k", "ira", "brokerage", "rsu"] as const;
export const SAVINGS_TYPES = [
  ...IL_SAVINGS_TYPES,
  ...US_SAVINGS_TYPES,
  "cash",
  "other",
] as const;
export type SavingsType = (typeof SAVINGS_TYPES)[number];

export const COUNTRIES = ["IL", "US"] as const;
export type Country = (typeof COUNTRIES)[number];
export const CURRENCIES = ["ILS", "USD"] as const;
export type Currency = (typeof CURRENCIES)[number];

/** Owner is a household member key ("asaf", "einat", a child's key) or "joint". */
export type OwnerKey = string;
export const JOINT_OWNER = "joint";

export const BENEFIT_CATEGORIES = [
  "life",
  "add",
  "ltd",
  "std",
  "work_capacity",
  "health",
  "dental",
  "vision",
  "critical_illness",
  "long_term_care",
  "hsa",
  "fsa",
  "espp",
  "401k_match",
  "other",
] as const;
export type BenefitCategory = (typeof BENEFIT_CATEGORIES)[number];
export const BENEFIT_PAYERS = ["employee", "employer", "split"] as const;

// ── Household profile shapes (stored as JSON on HouseholdProfile) ──

export interface HouseholdMember {
  key: string; // stable id used as SavingsAccount.owner / Benefit.owner
  name?: string | null;
  nameHe?: string | null;
  role: "adult" | "child";
  birthDate?: string | null; // YYYY-MM-DD
  // Adult-only:
  targetRetirementAge?: number | null;
  employment?: string | null; // e.g. "employee", "self-employed", employer name
  residence?: string | null; // country of residence, e.g. "US", "IL"
}

export interface HouseholdGoals {
  retirementTargetMonthlyIncome?: number | null;
  retirementTargetCurrency?: Currency | null;
  plannedPurchases?: {
    label: string;
    amount?: number | null;
    currency?: Currency | null;
    targetYear?: number | null;
  }[];
  relocation?: { plan?: string | null; country?: string | null; targetYear?: number | null } | null;
  childrenEducation?: string | null;
  other?: string | null;
}

// ── Dates ──────────────────────────────────────────────────────────

/**
 * Parse the date formats found in statements and the extractor JSON:
 * "YYYY-MM" (→ last day of that month), "YYYY-MM-DD", "DD/MM/YYYY", "DD.MM.YYYY".
 * Returns a UTC Date or null.
 */
export function parseLooseDate(input: string | null | undefined): Date | null {
  if (!input) return null;
  const s = String(input).trim();
  let m = /^(\d{4})-(\d{1,2})$/.exec(s);
  if (m) {
    const y = +m[1];
    const mo = +m[2];
    if (mo < 1 || mo > 12) return null;
    return new Date(Date.UTC(y, mo, 0)); // day 0 of next month = last day
  }
  m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
  if (m) return validDate(+m[1], +m[2], +m[3]);
  m = /^(\d{1,2})[/.](\d{1,2})[/.](\d{4})$/.exec(s);
  if (m) return validDate(+m[3], +m[2], +m[1]);
  return null;
}

function validDate(y: number, mo: number, d: number): Date | null {
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return dt;
}

export function toDateStr(d: Date | null | undefined): string | null {
  return d ? d.toISOString().slice(0, 10) : null;
}

/** Whole years between birthDate and asOf. */
export function ageAt(birthDate: string | Date | null | undefined, asOf: Date): number | null {
  const b = birthDate instanceof Date ? birthDate : parseLooseDate(birthDate ?? null);
  if (!b) return null;
  let age = asOf.getUTCFullYear() - b.getUTCFullYear();
  const mDiff = asOf.getUTCMonth() - b.getUTCMonth();
  if (mDiff < 0 || (mDiff === 0 && asOf.getUTCDate() < b.getUTCDate())) age--;
  return age;
}

function addYears(d: Date, years: number): Date {
  return new Date(Date.UTC(d.getUTCFullYear() + years, d.getUTCMonth(), d.getUTCDate()));
}

function monthsBetween(from: Date, to: Date): number {
  return (to.getUTCFullYear() - from.getUTCFullYear()) * 12 + (to.getUTCMonth() - from.getUTCMonth());
}

// ── FX ─────────────────────────────────────────────────────────────

/**
 * Fallback ILS-per-USD rate when neither the profile override nor the
 * USD_ILS_RATE env var is set.
 * TODO: replace with a live/daily rate source (e.g. Bank of Israel
 * representative rate API) and persist it with the snapshot date.
 */
export const DEFAULT_USD_ILS_RATE = 3.7;

export interface FxRate {
  usdIls: number; // ILS per 1 USD
  source: "profile" | "env" | "default";
}

export function resolveUsdIlsRate(opts: {
  profileOverride?: number | null;
  envValue?: string | null;
}): FxRate {
  if (opts.profileOverride && opts.profileOverride > 0) {
    return { usdIls: opts.profileOverride, source: "profile" };
  }
  const env = opts.envValue != null ? Number(opts.envValue) : NaN;
  if (Number.isFinite(env) && env > 0) return { usdIls: env, source: "env" };
  return { usdIls: DEFAULT_USD_ILS_RATE, source: "default" };
}

export function convert(amount: number, from: Currency, to: Currency, fx: FxRate): number {
  if (from === to) return amount;
  return from === "ILS" ? amount / fx.usdIls : amount * fx.usdIls;
}

export function toUsd(amount: number, from: Currency | string | null | undefined, fx: FxRate): number {
  return convert(amount, normalizeCurrency(from), "USD", fx);
}

export function normalizeCurrency(c: string | null | undefined): Currency {
  const s = (c ?? "").toUpperCase().trim();
  if (s === "USD" || s === "$") return "USD";
  return "ILS"; // ILS / NIS / ₪ / unknown → ILS (the Israeli reports' currency)
}

const round2 = (n: number) => Math.round(n * 100) / 100;

// ── Fees ───────────────────────────────────────────────────────────

/**
 * Benchmark fee levels used for "what would a competitive fee save" comparisons.
 * Percentages: deposit = % of each deposit, accumulation = % of balance/yr.
 * These are planning assumptions (approximate Israeli market levels for
 * negotiated/default-fund rates, and low-cost US index funds) — not quotes.
 * TODO: let the user override per account / refresh periodically.
 */
export const BENCHMARK_FEES: Record<string, { depositPct: number; accumulationPct: number }> = {
  pension: { depositPct: 1.0, accumulationPct: 0.22 }, // default-fund tender level
  managers_insurance: { depositPct: 2.0, accumulationPct: 0.5 },
  hishtalmut: { depositPct: 0, accumulationPct: 0.6 },
  gemel: { depositPct: 0, accumulationPct: 0.6 },
  gemel_investment: { depositPct: 0, accumulationPct: 0.6 },
  savings_policy: { depositPct: 0, accumulationPct: 0.75 },
  savings_child: { depositPct: 0, accumulationPct: 0.3 },
  "401k": { depositPct: 0, accumulationPct: 0.1 },
  ira: { depositPct: 0, accumulationPct: 0.1 },
  brokerage: { depositPct: 0, accumulationPct: 0.1 },
};

export interface FeeInput {
  balance: number;
  monthlyDeposit: number; // total monthly deposit
  feeDepositPct?: number | null;
  feeAccumulationPct?: number | null;
}

/** Annual fee cost in the account's currency at today's balance/deposits. */
export function annualFeeCost(i: FeeInput): { deposit: number; accumulation: number; total: number } {
  const deposit = (i.monthlyDeposit * 12 * (i.feeDepositPct ?? 0)) / 100;
  const accumulation = (i.balance * (i.feeAccumulationPct ?? 0)) / 100;
  return { deposit: round2(deposit), accumulation: round2(accumulation), total: round2(deposit + accumulation) };
}

export interface FeeDragInput extends FeeInput {
  years: number;
  grossReturnPct: number; // annual, before fees
  benchmark: { depositPct: number; accumulationPct: number };
}

export interface FeeDragResult {
  years: number;
  endBalanceActual: number;
  endBalanceBenchmark: number;
  /** How much less you end with at current fees vs benchmark fees. */
  costVsBenchmark: number;
  totalFeesActual: number;
  totalFeesBenchmark: number;
}

/**
 * Project the balance forward N years with monthly deposits and monthly
 * compounding, once at the account's fees and once at benchmark fees.
 */
export function projectFeeDrag(i: FeeDragInput): FeeDragResult {
  const run = (depPct: number, accPct: number) => {
    let bal = i.balance;
    let fees = 0;
    const months = Math.max(0, Math.round(i.years * 12));
    const rMonthly = Math.pow(1 + i.grossReturnPct / 100, 1 / 12) - 1;
    const accMonthly = accPct / 100 / 12;
    for (let m = 0; m < months; m++) {
      const depFee = (i.monthlyDeposit * depPct) / 100;
      bal += i.monthlyDeposit - depFee;
      bal *= 1 + rMonthly;
      const accFee = bal * accMonthly;
      bal -= accFee;
      fees += depFee + accFee;
    }
    return { bal, fees };
  };
  const actual = run(i.feeDepositPct ?? 0, i.feeAccumulationPct ?? 0);
  const bench = run(i.benchmark.depositPct, i.benchmark.accumulationPct);
  return {
    years: i.years,
    endBalanceActual: round2(actual.bal),
    endBalanceBenchmark: round2(bench.bal),
    costVsBenchmark: round2(bench.bal - actual.bal),
    totalFeesActual: round2(actual.fees),
    totalFeesBenchmark: round2(bench.fees),
  };
}

// ── Hishtalmut liquidity ───────────────────────────────────────────

export interface LiquidityStatus {
  status: "liquid" | "locked" | "unknown";
  liquidityDate: string | null;
  monthsRemaining: number | null;
  basis: "statement" | "openDate+6y" | "none";
}

/**
 * Keren hishtalmut becomes withdrawable tax-free 6 years after opening
 * (3 years for withdrawals at retirement age — not modelled here). Prefer the
 * liquidity date printed on the statement; else derive from openDate + 6y.
 */
export function hishtalmutLiquidity(
  a: { liquidityDate?: string | Date | null; openDate?: string | Date | null },
  asOf: Date
): LiquidityStatus {
  const asDate = (v: string | Date | null | undefined) =>
    v instanceof Date ? v : parseLooseDate(v ?? null);
  let date = asDate(a.liquidityDate);
  let basis: LiquidityStatus["basis"] = "statement";
  if (!date) {
    const open = asDate(a.openDate);
    if (open) {
      date = addYears(open, 6);
      basis = "openDate+6y";
    }
  }
  if (!date) return { status: "unknown", liquidityDate: null, monthsRemaining: null, basis: "none" };
  if (date.getTime() <= asOf.getTime()) {
    return { status: "liquid", liquidityDate: toDateStr(date), monthsRemaining: 0, basis };
  }
  return {
    status: "locked",
    liquidityDate: toDateStr(date),
    monthsRemaining: Math.max(1, monthsBetween(asOf, date)),
    basis,
  };
}

// ── Retirement ─────────────────────────────────────────────────────

/** Used when a member has no targetRetirementAge (Israeli statutory: men 67, women ~65 rising). */
export const DEFAULT_RETIREMENT_AGE = 67;
/** Planning assumption: real (after-inflation) annual return, net of nothing. */
export const DEFAULT_REAL_RETURN_PCT = 4;

export interface RetirementTiming {
  memberKey: string;
  age: number | null;
  targetRetirementAge: number;
  targetAgeAssumed: boolean;
  yearsToRetirement: number | null;
  assumptions: string[];
}

export function retirementTiming(member: HouseholdMember, asOf: Date): RetirementTiming {
  const age = ageAt(member.birthDate ?? null, asOf);
  const assumptions: string[] = [];
  const assumed = !member.targetRetirementAge;
  const target = member.targetRetirementAge || DEFAULT_RETIREMENT_AGE;
  if (assumed) {
    assumptions.push(
      `Target retirement age not set for ${member.key}; assumed ${DEFAULT_RETIREMENT_AGE} (Israeli statutory age is 67 for men and ~65 rising for women).`
    );
  }
  if (age == null) assumptions.push(`Birth date missing for ${member.key}; years to retirement unknown.`);
  return {
    memberKey: member.key,
    age,
    targetRetirementAge: target,
    targetAgeAssumed: assumed,
    yearsToRetirement: age == null ? null : Math.max(0, target - age),
    assumptions,
  };
}

export interface RetirementProjectionInput {
  currentBalance: number;
  monthlyContribution: number;
  years: number;
  realReturnPct?: number; // annual, net of fees; default DEFAULT_REAL_RETURN_PCT
  /** Israeli annuity conversion factor (מקדם המרה), e.g. 200 → monthly = balance/200. */
  conversionFactor?: number | null;
  /** Fallback safe-withdrawal rate when no conversion factor (annual %, default 4). */
  withdrawalRatePct?: number;
}

export interface RetirementProjection {
  years: number;
  realReturnPct: number;
  projectedBalance: number; // in today's money (real)
  monthlyIncomeEstimate: number;
  incomeMethod: "conversionFactor" | "withdrawalRate";
  timeline: { year: number; balance: number }[];
}

/** FV of balance + monthly contributions, monthly compounding at a real return. */
export function projectRetirement(i: RetirementProjectionInput): RetirementProjection {
  const realReturnPct = i.realReturnPct ?? DEFAULT_REAL_RETURN_PCT;
  const r = Math.pow(1 + realReturnPct / 100, 1 / 12) - 1;
  const years = Math.max(0, i.years);
  const timeline: { year: number; balance: number }[] = [{ year: 0, balance: round2(i.currentBalance) }];
  let bal = i.currentBalance;
  for (let y = 1; y <= Math.ceil(years); y++) {
    const months = y <= years ? 12 : Math.round((years - (y - 1)) * 12);
    for (let m = 0; m < months; m++) bal = bal * (1 + r) + i.monthlyContribution;
    timeline.push({ year: y, balance: round2(bal) });
  }
  const useCf = !!(i.conversionFactor && i.conversionFactor > 0);
  const monthly = useCf
    ? bal / (i.conversionFactor as number)
    : (bal * ((i.withdrawalRatePct ?? 4) / 100)) / 12;
  return {
    years,
    realReturnPct,
    projectedBalance: round2(bal),
    monthlyIncomeEstimate: round2(monthly),
    incomeMethod: useCf ? "conversionFactor" : "withdrawalRate",
    timeline,
  };
}

// ── Children ───────────────────────────────────────────────────────

export interface ChildMilestones {
  memberKey: string;
  age: number | null;
  turns18: string | null; // YYYY-MM-DD — army service / חיסכון לכל ילד first unlock
  turns21: string | null; // חיסכון לכל ילד bonus unlock / typical post-army university start
  hasSavingsForEveryChildAccount: boolean;
  savingsForEveryChildBalanceUsd: number;
}

export function childMilestones(
  members: HouseholdMember[],
  accounts: { owner: string; type: string; balanceUsd: number }[],
  asOf: Date
): ChildMilestones[] {
  return members
    .filter((m) => m.role === "child")
    .map((m) => {
      const b = parseLooseDate(m.birthDate ?? null);
      const childAccts = accounts.filter((a) => a.owner === m.key && a.type === "savings_child");
      return {
        memberKey: m.key,
        age: ageAt(b, asOf),
        turns18: b ? toDateStr(addYears(b, 18)) : null,
        turns21: b ? toDateStr(addYears(b, 21)) : null,
        hasSavingsForEveryChildAccount: childAccts.length > 0,
        savingsForEveryChildBalanceUsd: round2(childAccts.reduce((s, a) => s + a.balanceUsd, 0)),
      };
    });
}

// ── Net worth ──────────────────────────────────────────────────────

export interface SavingsAccountLite {
  id: string;
  owner: string;
  country: string;
  type: string;
  provider: string;
  planName?: string | null;
  policyLast4?: string | null;
  status?: string | null;
  currency: string;
  balance: number;
  balanceAsOf?: string | null; // YYYY-MM-DD
  track?: string | null;
  feeDepositPct?: number | null;
  feeAccumulationPct?: number | null;
  monthlyDepositEmployee?: number | null;
  monthlyDepositEmployer?: number | null;
  monthlyDepositSeverance?: number | null;
  monthlyDepositTotal?: number | null;
  insuredSalary?: number | null;
  liquidityDate?: string | null;
  projectedMonthlyPension?: number | null;
  details?: Record<string, unknown> | null;
  source?: string;
  archivedAt?: string | null;
}

export interface PropertyLite {
  id: string;
  title: string;
  currentValue: number | null;
  purchasePrice: number | null;
  valueAsOf: string | null;
  mortgageBalance: number | null;
  mortgageAsOf: string | null;
}

export interface TradeEquityLite {
  startingBalance: number;
  realizedPnL: number; // all-time realized P&L
  netFunds: number; // deposits − withdrawals (FundTransaction)
}

export interface SnapshotLite {
  savingsAccountId: string;
  asOf: string; // YYYY-MM-DD
  balance: number;
}

export function monthlyDepositOf(a: SavingsAccountLite): number {
  const split = (a.monthlyDepositEmployee ?? 0) + (a.monthlyDepositEmployer ?? 0) + (a.monthlyDepositSeverance ?? 0);
  return Math.max(split, a.monthlyDepositTotal ?? 0);
}

export interface SavingsAccountView extends SavingsAccountLite {
  balanceUsd: number;
  balanceIls: number;
  monthlyDeposit: number;
  annualFees: { deposit: number; accumulation: number; total: number; totalUsd: number };
  feeDrag10y: FeeDragResult | null; // vs BENCHMARK_FEES, in account currency
  liquidity: LiquidityStatus | null; // hishtalmut only
}

export interface PropertyView extends PropertyLite {
  value: number; // USD
  valueSource: "currentValue" | "purchasePrice" | "none";
  mortgage: number; // USD (0 if unknown)
  equity: number;
}

export interface NetWorthPayload {
  asOf: string; // YYYY-MM-DD
  baseCurrency: "USD";
  fx: FxRate;
  totals: {
    netWorthUsd: number;
    netWorthIls: number;
    assetsUsd: number;
    liabilitiesUsd: number;
  };
  byModule: {
    savingsUsd: number;
    propertiesEquityUsd: number;
    propertiesValueUsd: number;
    mortgagesUsd: number;
    tradeUsd: number;
  };
  /** Savings only (properties/trade are household-level). */
  byOwner: Record<string, number>;
  byCountry: Record<string, number>; // savings by IL/US
  byType: Record<string, number>; // savings by type
  savings: {
    accounts: SavingsAccountView[];
    totalUsd: number;
    annualFeesUsd: number;
    monthlyDepositsUsd: number;
  };
  properties: PropertyView[];
  trade: (TradeEquityLite & { equityUsd: number }) | null;
  /** Savings balance over time (month-end, carry-forward), converted at today's rate. */
  history: { month: string; savingsUsd: number }[];
  dataGaps: string[];
}

export interface NetWorthInput {
  asOf: Date;
  fx: FxRate;
  savings: SavingsAccountLite[];
  properties: PropertyLite[];
  trade: TradeEquityLite | null;
  snapshots?: SnapshotLite[];
  feeDragYears?: number;
  grossReturnPct?: number;
}

const inc = (rec: Record<string, number>, k: string, v: number) => {
  rec[k] = round2((rec[k] ?? 0) + v);
};

export function buildNetWorth(input: NetWorthInput): NetWorthPayload {
  const { fx, asOf } = input;
  const gaps: string[] = [];
  const years = input.feeDragYears ?? 10;
  const gross = input.grossReturnPct ?? 5;

  const active = input.savings.filter((a) => !a.archivedAt);
  const byOwner: Record<string, number> = {};
  const byCountry: Record<string, number> = {};
  const byType: Record<string, number> = {};
  let annualFeesUsd = 0;
  let monthlyDepositsUsd = 0;

  const accounts: SavingsAccountView[] = active.map((a) => {
    const cur = normalizeCurrency(a.currency);
    const balanceUsd = round2(convert(a.balance, cur, "USD", fx));
    const balanceIls = round2(convert(a.balance, cur, "ILS", fx));
    const monthlyDeposit = monthlyDepositOf(a);
    const fees = annualFeeCost({
      balance: a.balance,
      monthlyDeposit,
      feeDepositPct: a.feeDepositPct,
      feeAccumulationPct: a.feeAccumulationPct,
    });
    const feesUsd = round2(convert(fees.total, cur, "USD", fx));
    const bench = BENCHMARK_FEES[a.type];
    const hasFees = a.feeDepositPct != null || a.feeAccumulationPct != null;
    const feeDrag10y =
      bench && hasFees
        ? projectFeeDrag({
            balance: a.balance,
            monthlyDeposit,
            feeDepositPct: a.feeDepositPct,
            feeAccumulationPct: a.feeAccumulationPct,
            years,
            grossReturnPct: gross,
            benchmark: bench,
          })
        : null;
    const openDate = typeof a.details?.openDate === "string" ? (a.details.openDate as string) : null;
    const liquidity = a.type === "hishtalmut" ? hishtalmutLiquidity({ liquidityDate: a.liquidityDate, openDate }, asOf) : null;

    inc(byOwner, a.owner, balanceUsd);
    inc(byCountry, a.country, balanceUsd);
    inc(byType, a.type, balanceUsd);
    annualFeesUsd += feesUsd;
    monthlyDepositsUsd += convert(monthlyDeposit, cur, "USD", fx);

    if (!hasFees && a.type !== "cash" && a.type !== "other" && a.type !== "rsu") {
      gaps.push(`Fees missing for ${a.provider} ${a.type} (${a.owner}).`);
    }
    if (a.balanceAsOf) {
      const d = parseLooseDate(a.balanceAsOf);
      if (d && monthsBetween(d, asOf) > 6) gaps.push(`Balance for ${a.provider} ${a.type} (${a.owner}) is older than 6 months (${a.balanceAsOf}).`);
    } else {
      gaps.push(`Balance date missing for ${a.provider} ${a.type} (${a.owner}).`);
    }

    return {
      ...a,
      balanceUsd,
      balanceIls,
      monthlyDeposit: round2(monthlyDeposit),
      annualFees: { ...fees, totalUsd: feesUsd },
      feeDrag10y,
      liquidity,
    };
  });
  const savingsUsd = round2(accounts.reduce((s, a) => s + a.balanceUsd, 0));

  // Property amounts are stored in USD (US rentals).
  const properties: PropertyView[] = input.properties.map((p) => {
    let value = 0;
    let valueSource: PropertyView["valueSource"] = "none";
    if (p.currentValue != null) {
      value = p.currentValue;
      valueSource = "currentValue";
    } else if (p.purchasePrice != null) {
      value = p.purchasePrice;
      valueSource = "purchasePrice";
      gaps.push(`No current value for ${p.title}; using purchase price.`);
    } else {
      gaps.push(`No value for ${p.title}.`);
    }
    if (p.mortgageBalance == null) gaps.push(`Mortgage balance unknown for ${p.title} (treated as 0).`);
    const mortgage = p.mortgageBalance ?? 0;
    return { ...p, value: round2(value), valueSource, mortgage: round2(mortgage), equity: round2(value - mortgage) };
  });
  const propertiesValueUsd = round2(properties.reduce((s, p) => s + p.value, 0));
  const mortgagesUsd = round2(properties.reduce((s, p) => s + p.mortgage, 0));

  const trade = input.trade
    ? { ...input.trade, equityUsd: round2(input.trade.startingBalance + input.trade.realizedPnL + input.trade.netFunds) }
    : null;
  if (!trade) gaps.push("Trade account not available.");
  const tradeUsd = trade ? trade.equityUsd : 0;

  const assetsUsd = round2(savingsUsd + propertiesValueUsd + Math.max(0, tradeUsd));
  const liabilitiesUsd = round2(mortgagesUsd + Math.max(0, -tradeUsd));
  const netWorthUsd = round2(assetsUsd - liabilitiesUsd);

  return {
    asOf: toDateStr(asOf) as string,
    baseCurrency: "USD",
    fx,
    totals: {
      netWorthUsd,
      netWorthIls: round2(netWorthUsd * fx.usdIls),
      assetsUsd,
      liabilitiesUsd,
    },
    byModule: {
      savingsUsd,
      propertiesEquityUsd: round2(propertiesValueUsd - mortgagesUsd),
      propertiesValueUsd,
      mortgagesUsd,
      tradeUsd,
    },
    byOwner,
    byCountry,
    byType,
    savings: {
      accounts,
      totalUsd: savingsUsd,
      annualFeesUsd: round2(annualFeesUsd),
      monthlyDepositsUsd: round2(monthlyDepositsUsd),
    },
    properties,
    trade,
    history: savingsHistory(active, input.snapshots ?? [], fx),
    dataGaps: gaps,
  };
}

/**
 * Month-end savings totals: for each month with any snapshot, sum each
 * account's latest known balance at or before that month (carry-forward).
 * Converted at the current FX rate (historical rates not tracked).
 */
export function savingsHistory(
  accounts: Pick<SavingsAccountLite, "id" | "currency">[],
  snapshots: SnapshotLite[],
  fx: FxRate
): { month: string; savingsUsd: number }[] {
  const cur = new Map(accounts.map((a) => [a.id, normalizeCurrency(a.currency)]));
  const relevant = snapshots.filter((s) => cur.has(s.savingsAccountId));
  if (relevant.length === 0) return [];
  const months = [...new Set(relevant.map((s) => s.asOf.slice(0, 7)))].sort();
  const sorted = [...relevant].sort((a, b) => a.asOf.localeCompare(b.asOf));
  return months.map((month) => {
    const latest = new Map<string, number>();
    for (const s of sorted) {
      if (s.asOf.slice(0, 7) > month) break;
      latest.set(s.savingsAccountId, s.balance);
    }
    let total = 0;
    for (const [id, bal] of latest) total += convert(bal, cur.get(id) as Currency, "USD", fx);
    return { month, savingsUsd: round2(total) };
  });
}

// ── Coverage overlaps ──────────────────────────────────────────────

export interface BenefitLite {
  id: string;
  owner: string;
  country: string;
  source: string;
  category: string;
  coverageAmount?: number | null;
  coverageCurrency?: string | null;
  monthlyCost?: number | null;
  costCurrency?: string | null;
  linkedSavingsAccountId?: string | null;
  archivedAt?: string | null;
}

/** Categories that insure the same underlying risk are compared together. */
export function riskOf(category: string): string {
  switch (category) {
    case "life":
      return "death";
    case "add":
      return "accidental_death";
    case "ltd":
    case "work_capacity":
      return "disability";
    case "std":
      return "short_term_disability";
    default:
      return category;
  }
}

/** Risks where holding several policies is usually redundant (vs. additive needs). */
const DUPLICATE_RISKS = new Set([
  "death",
  "accidental_death",
  "disability",
  "short_term_disability",
  "critical_illness",
  "long_term_care",
  "health",
]);

export interface CoverageGroup {
  owner: string;
  risk: string;
  categories: string[];
  countries: string[];
  count: number;
  totalCoverageUsd: number;
  monthlyCostUsd: number;
  duplicate: boolean;
  items: {
    id: string;
    source: string;
    country: string;
    category: string;
    coverageUsd: number | null;
    monthlyCostUsd: number | null;
    insideSavingsAccount: boolean;
  }[];
}

export interface CoverageGap {
  owner: string;
  risk: string;
  message: string;
}

export interface CoverageReport {
  groups: CoverageGroup[];
  duplicates: CoverageGroup[];
  gaps: CoverageGap[];
  totalMonthlyCostUsd: number;
}

/**
 * Group benefits by owner + underlying risk across countries; flag risks
 * covered by more than one policy as potential duplicates, and adults with
 * no death or disability (loss-of-work-capacity) cover as gaps.
 */
export function findCoverageOverlaps(
  benefits: BenefitLite[],
  members: HouseholdMember[],
  fx: FxRate
): CoverageReport {
  const active = benefits.filter((b) => !b.archivedAt);
  const map = new Map<string, CoverageGroup>();
  for (const b of active) {
    const risk = riskOf(b.category);
    const key = `${b.owner}|${risk}`;
    let g = map.get(key);
    if (!g) {
      g = { owner: b.owner, risk, categories: [], countries: [], count: 0, totalCoverageUsd: 0, monthlyCostUsd: 0, duplicate: false, items: [] };
      map.set(key, g);
    }
    const coverageUsd = b.coverageAmount != null ? round2(toUsd(b.coverageAmount, b.coverageCurrency, fx)) : null;
    const costUsd = b.monthlyCost != null ? round2(toUsd(b.monthlyCost, b.costCurrency ?? b.coverageCurrency, fx)) : null;
    g.items.push({
      id: b.id,
      source: b.source,
      country: b.country,
      category: b.category,
      coverageUsd,
      monthlyCostUsd: costUsd,
      insideSavingsAccount: !!b.linkedSavingsAccountId,
    });
    if (!g.categories.includes(b.category)) g.categories.push(b.category);
    if (!g.countries.includes(b.country)) g.countries.push(b.country);
    g.count++;
    g.totalCoverageUsd = round2(g.totalCoverageUsd + (coverageUsd ?? 0));
    g.monthlyCostUsd = round2(g.monthlyCostUsd + (costUsd ?? 0));
  }
  const groups = [...map.values()].map((g) => ({ ...g, duplicate: g.count > 1 && DUPLICATE_RISKS.has(g.risk) }));
  groups.sort((a, b) => a.owner.localeCompare(b.owner) || a.risk.localeCompare(b.risk));

  const adults = members.filter((m) => m.role === "adult").map((m) => m.key);
  const owners = adults.length > 0 ? adults : [...new Set(active.map((b) => b.owner))].filter((o) => o !== JOINT_OWNER);
  const gaps: CoverageGap[] = [];
  for (const owner of owners) {
    const has = (risk: string) => groups.some((g) => g.owner === owner && g.risk === risk);
    if (!has("disability")) {
      gaps.push({ owner, risk: "disability", message: `No disability / loss-of-work-capacity (אובדן כושר עבודה) cover recorded for ${owner}.` });
    }
    if (!has("death")) {
      gaps.push({ owner, risk: "death", message: `No life / death cover recorded for ${owner}.` });
    }
  }
  return {
    groups,
    duplicates: groups.filter((g) => g.duplicate),
    gaps,
    totalMonthlyCostUsd: round2(groups.reduce((s, g) => s + g.monthlyCostUsd, 0)),
  };
}

// ── Misc helpers ───────────────────────────────────────────────────

/** Keep only the last 4 digits of a policy/account number (null if none). */
export function policyLast4(policyNumber: string | number | null | undefined): string | null {
  if (policyNumber == null) return null;
  const digits = String(policyNumber).replace(/\D/g, "");
  if (!digits) return null;
  return digits.slice(-4);
}

/** Canonical key for upserting an imported account. */
export function savingsMatchKey(a: { owner: string; provider: string; type: string; policyLast4: string | null }): string {
  return [a.owner, a.provider.trim().toLowerCase(), a.type, a.policyLast4 ?? ""].join("|");
}
