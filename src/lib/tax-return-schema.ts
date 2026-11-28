// Filed tax returns (US federal + Georgia), extracted outside the app by the
// import-tax-return Claude Code skill and posted to /api/savings/tax-returns.
// Pure: zod schema, DTO types and the PII guard. Every money field is
// `number | null` — a line not printed on the return stays null.
//
// PII rule: nothing that identifies a person or an account may be stored —
// no SSN/ITIN, EIN, PTIN, birth dates, PINs, bank/foreign account or routing
// numbers. People are household member keys. `findPii` enforces it on every
// string and key before a record is accepted.

import { z } from "zod";
import { PROPERTY_CATEGORIES } from "./property";

export const TAX_JURISDICTIONS = ["US-federal", "US-GA"] as const;
export type TaxJurisdiction = (typeof TAX_JURISDICTIONS)[number];

export const SCHEDULE_E_LINE_KEYS = PROPERTY_CATEGORIES.map((c) => c.key) as [string, ...string[]];
export type ScheduleELineKey = (typeof SCHEDULE_E_LINE_KEYS)[number];

const money = z.number().finite().nullish().transform((v) => v ?? null);
const text = (max = 300) => z.string().trim().max(max).nullish().transform((v) => v || null);
const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .nullish()
  .transform((v) => v ?? null);
const section = <T extends z.ZodRawShape>(shape: T) => z.object(shape).nullish().transform((v) => v ?? null);
const list = <T extends z.ZodTypeAny>(item: T) => z.array(item).nullish().transform((v) => v ?? []);

const summarySchema = section({
  wages: money,
  taxableInterest: money,
  ordinaryDividends: money,
  qualifiedDividends: money,
  capitalGainLoss: money,
  scheduleC: money,
  form4797: money,
  scheduleE: money,
  otherIncome: money,
  totalIncome: money,
  adjustments: money,
  agi: money,
  standardDeduction: money,
  itemized: section({ taxes: money, interest: money, contributions: money, other: money, total: money }),
  qbiDeduction: money,
  taxableIncome: money,
  tax: money,
  credits: section({ foreignTax: money, childCare: money, childTax: money, other: money, total: money }),
  selfEmploymentTax: money,
  additionalMedicare: money,
  niit: money,
  otherTaxes: money,
  totalTax: money,
  withholdingW2: money,
  withholdingOther: money,
  estimatedPayments: money,
  totalPayments: money,
  refund: money,
  amountOwed: money,
  marginalBracketPct: money,
});

const depreciationSchema = section({
  basis: money,
  land: money,
  method: text(80),
  placedInService: isoDate,
  prior: money,
  current: money,
});

const rentalSchema = z.object({
  address: z.string().trim().min(1).max(200),
  propertyId: text(64),
  unitIds: z.array(z.string().max(64)).nullish().transform((v) => v ?? null),
  daysRented: money,
  lines: z.record(z.enum(SCHEDULE_E_LINE_KEYS), money).nullish().transform((v) => v ?? {}),
  net: money,
  depreciation: depreciationSchema,
});

const memberKey = z.string().trim().min(1).max(40);

const taxReturnDataSchema = z.object({
  summary: summarySchema,
  rentals: list(rentalSchema),
  passiveLosses: section({
    allowed: money,
    suspended: money,
    byActivity: list(z.object({ activity: z.string().max(200), suspended: money })),
  }),
  business: list(
    z.object({ owner: memberKey, activity: text(200), grossReceipts: money, expenses: money, net: money, homeOffice: money })
  ),
  capitalGains: section({ shortTerm: money, longTerm: money, carryover: money, sales4797: money }),
  foreign: section({
    taxCredit: list(z.object({ basket: z.string().max(60), credit: money, carryover: money })),
    form8938Filed: z.boolean().nullish().transform((v) => v ?? null),
    fbarFiled: z.boolean().nullish().transform((v) => v ?? null),
    accountCount: money,
    aggregateMaxValueUsd: money,
    accounts: list(
      z.object({ institution: z.string().max(120), type: text(60), owner: memberKey, maxValueUsd: money })
    ),
  }),
  hsa: section({ contributions: money, employerContributions: money, deduction: money, distributions: money }),
  childCare: section({ expenses: money, credit: money, dependentCareBenefits: money }),
  childTaxCredit: section({ credit: money, additional: money }),
  amt: section({ amti: money, amt: money }),
  carryovers: list(z.object({ form: z.string().max(40), description: z.string().max(200), amount: money })),
  state: section({
    agi: money,
    adjustments: money,
    taxableIncome: money,
    tax: money,
    credits: money,
    withholding: money,
    estimatedPayments: money,
    refund: money,
    amountOwed: money,
    estimatedVouchers: list(z.object({ dueDate: isoDate, amount: money })),
  }),
  notes: list(z.string().max(1000)),
});

export const taxReturnInputSchema = z.object({
  taxYear: z.number().int().min(2000).max(2100),
  jurisdiction: z.enum(TAX_JURISDICTIONS),
  filingStatus: text(40),
  preparer: text(120),
  source: text(200),
  partial: z.boolean().default(false),
  amended: z.boolean().default(false),
  data: taxReturnDataSchema,
});

export type TaxReturnInput = z.output<typeof taxReturnInputSchema>;
export type TaxReturnData = TaxReturnInput["data"];
export type ScheduleERental = TaxReturnData["rentals"][number];

export class TaxReturnError extends Error {}

// SSN/ITIN, EIN, and any 9+ digit run (account, routing, PTIN digits, IDs).
const PII_PATTERNS = [/\b\d{3}-\d{2}-\d{4}\b/, /\b\d{2}-\d{7}\b/, /\d{9,}/, /\bP\d{8}\b/];
const PII_KEYS = /birth|dob|ssn|itin|\bein\b|ptin|routing|accountnumber|account_number|\bpin\b/i;

/** JSON paths of strings or keys that look like personal identifiers. */
export function findPii(value: unknown, path: string[] = []): string[] {
  if (typeof value === "string") return PII_PATTERNS.some((re) => re.test(value)) ? [path.join(".")] : [];
  if (Array.isArray(value)) return value.flatMap((v, i) => findPii(v, [...path, String(i)]));
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([k, v]) => {
      const p = [...path, k];
      return PII_KEYS.test(k) ? [p.join(".")] : findPii(v, p);
    });
  }
  return [];
}

/** Validate an extracted return; throws TaxReturnError naming every problem. */
export function parseTaxReturn(raw: unknown): TaxReturnInput {
  const pii = findPii(raw);
  if (pii.length) throw new TaxReturnError(`Personal identifiers are not allowed: ${pii.join(", ")}`);
  const parsed = taxReturnInputSchema.safeParse(raw);
  if (!parsed.success) {
    throw new TaxReturnError(parsed.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`).join("; "));
  }
  return parsed.data;
}
