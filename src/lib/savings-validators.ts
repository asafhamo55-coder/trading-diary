import { z } from "zod";
import { BENEFIT_CATEGORIES, BENEFIT_PAYERS, CONTACT_ROLES, COUNTRIES, CURRENCIES, SAVINGS_TYPES } from "./savings";

// Numbers from the extractor may arrive as strings ("1,234.5", "0.22%").
function looseNumber(v: unknown): unknown {
  if (typeof v !== "string") return v;
  const s = v.replace(/[,\s%₪$]/g, "");
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : v;
}
const num = z.preprocess(looseNumber, z.number().finite().nullable().optional());
const dateStr = z.string().max(20).nullable().optional();
const memberKey = z
  .string()
  .min(1)
  .max(40)
  .regex(/^[a-z0-9_-]+$/i, "Member key must be letters, digits, - or _");

export const savingsTypeSchema = z.enum(SAVINGS_TYPES);
export const countrySchema = z.enum(COUNTRIES);
export const currencySchema = z.enum(CURRENCIES);

// ── Accounts ───────────────────────────────────────────────────────

export const createSavingsAccountSchema = z.object({
  owner: memberKey,
  country: countrySchema,
  type: savingsTypeSchema,
  provider: z.string().min(1, "Provider is required").max(120),
  planName: z.string().max(200).nullable().optional(),
  // Stored in full (user opted in); the last 4 digits are also kept as the match key.
  policyNumber: z.string().max(60).nullable().optional(),
  loginUrl: z.string().url().max(500).nullable().optional(),
  status: z.string().max(60).nullable().optional(),
  currency: currencySchema,
  balance: z.number().finite(),
  balanceAsOf: dateStr,
  track: z.string().max(200).nullable().optional(),
  feeDepositPct: z.number().min(0).max(10).nullable().optional(),
  feeAccumulationPct: z.number().min(0).max(5).nullable().optional(),
  monthlyDepositEmployee: z.number().min(0).nullable().optional(),
  monthlyDepositEmployer: z.number().min(0).nullable().optional(),
  monthlyDepositSeverance: z.number().min(0).nullable().optional(),
  monthlyDepositTotal: z.number().min(0).nullable().optional(),
  insuredSalary: z.number().min(0).nullable().optional(),
  liquidityDate: dateStr,
  projectedMonthlyPension: z.number().min(0).nullable().optional(),
  details: z.record(z.string(), z.unknown()).nullable().optional(),
});
export type CreateSavingsAccountInput = z.infer<typeof createSavingsAccountSchema>;

export const updateSavingsAccountSchema = createSavingsAccountSchema
  .partial()
  .extend({ archived: z.boolean().optional() });

// ── Profile ────────────────────────────────────────────────────────

export const householdMemberSchema = z.object({
  key: memberKey,
  name: z.string().max(80).nullable().optional(),
  nameHe: z.string().max(80).nullable().optional(),
  role: z.enum(["adult", "child"]),
  birthDate: dateStr,
  targetRetirementAge: z.number().int().min(40).max(90).nullable().optional(),
  employment: z.string().max(200).nullable().optional(),
  residence: z.string().max(60).nullable().optional(),
});

export const householdGoalsSchema = z.object({
  retirementTargetMonthlyIncome: z.number().min(0).nullable().optional(),
  retirementTargetCurrency: currencySchema.nullable().optional(),
  plannedPurchases: z
    .array(
      z.object({
        label: z.string().min(1).max(200),
        amount: z.number().min(0).nullable().optional(),
        currency: currencySchema.nullable().optional(),
        targetYear: z.number().int().min(2000).max(2100).nullable().optional(),
      })
    )
    .max(50)
    .optional(),
  relocation: z
    .object({
      plan: z.string().max(500).nullable().optional(),
      country: z.string().max(60).nullable().optional(),
      targetYear: z.number().int().min(2000).max(2100).nullable().optional(),
    })
    .nullable()
    .optional(),
  childrenEducation: z.string().max(2000).nullable().optional(),
  other: z.string().max(2000).nullable().optional(),
});

export const householdContactSchema = z.object({
  id: z.string().min(1).max(40).regex(/^[a-z0-9_-]+$/i, "Contact id must be letters, digits, - or _"),
  name: z.string().trim().min(1).max(120),
  role: z.enum(CONTACT_ROLES),
  country: z.enum(["IL", "US"]),
  email: z.string().trim().email().max(200).nullable().optional().or(z.literal("").transform(() => null)),
  phone: z.string().trim().max(40).nullable().optional(),
  language: z.enum(["he", "en"]),
  notes: z.string().max(1000).nullable().optional(),
});

export const updateProfileSchema = z.object({
  members: z
    .array(householdMemberSchema)
    .max(20)
    .refine((ms) => new Set(ms.map((m) => m.key)).size === ms.length, "Member keys must be unique")
    .nullable()
    .optional(),
  goals: householdGoalsSchema.nullable().optional(),
  goalsText: z.string().max(5000).nullable().optional(),
  riskTolerance: z.string().max(200).nullable().optional(),
  usdIlsRate: z.number().min(1).max(10).nullable().optional(),
  contacts: z
    .array(householdContactSchema)
    .max(50)
    .refine((cs) => new Set(cs.map((c) => c.id)).size === cs.length, "Contact ids must be unique")
    .nullable()
    .optional(),
});

// ── Benefits ───────────────────────────────────────────────────────

export const createBenefitSchema = z.object({
  owner: memberKey,
  country: countrySchema,
  source: z.string().min(1).max(120),
  category: z.enum(BENEFIT_CATEGORIES),
  coverageAmount: z.number().min(0).nullable().optional(),
  coverageCurrency: currencySchema.nullable().optional(),
  monthlyCost: z.number().min(0).nullable().optional(),
  costCurrency: currencySchema.nullable().optional(),
  payer: z.enum(BENEFIT_PAYERS).nullable().optional(),
  beneficiary: z.string().max(200).nullable().optional(),
  endsAt: dateStr,
  linkedSavingsAccountId: z.string().max(40).nullable().optional(),
  details: z.record(z.string(), z.unknown()).nullable().optional(),
});
export const updateBenefitSchema = createBenefitSchema
  .partial()
  .extend({ archived: z.boolean().optional() });

// ── Israeli PDF-extract import ─────────────────────────────────────

const importCoverageSchema = z
  .object({
    type: z.string().max(80).nullable().optional(),
    typeHe: z.string().max(120).nullable().optional(),
    amount: num,
    monthlyCost: num,
  })
  .passthrough();

const importProductSchema = z
  .object({
    type: z.string().max(40),
    typeHe: z.string().max(120).nullable().optional(),
    provider: z.string().min(1).max(120),
    planName: z.string().max(200).nullable().optional(),
    policyNumber: z.union([z.string(), z.number()]).nullable().optional(),
    status: z.string().max(60).nullable().optional(),
    openDate: dateStr,
    liquidityDate: dateStr,
    balance: num,
    track: z.string().max(200).nullable().optional(),
    ytdReturnPct: num,
    returns: z.unknown().optional(),
    feeDepositPct: num,
    feeAccumulationPct: num,
    conversionFactor: num,
    guaranteedFactor: z.unknown().optional(),
    monthlyDeposit: z
      .object({ employee: num, employer: num, severance: num, total: num })
      .partial()
      .nullable()
      .optional(),
    insuredSalary: num,
    projectedMonthlyPension: num,
    projectedLumpSum: num,
    coverages: z.array(importCoverageSchema).max(50).nullable().optional(),
    notes: z.unknown().optional(),
    sourcePage: z.unknown().optional(),
  })
  .passthrough();

const importPersonSchema = z
  .object({
    key: memberKey,
    nameHe: z.string().max(80).nullable().optional(),
    nameEn: z.string().max(80).nullable().optional(),
    birthDate: dateStr,
    retirementAge: num,
    summary: z.record(z.string(), z.unknown()).nullable().optional(),
    products: z.array(importProductSchema).max(100),
  })
  .passthrough();

export const savingsImportSchema = z
  .object({
    asOf: z.record(z.string(), z.string()),
    currency: z.string().max(5).optional(),
    people: z.array(importPersonSchema).min(1).max(20),
    agentNotes: z.array(z.unknown()).optional(),
  })
  .passthrough();
export type SavingsImportDoc = z.infer<typeof savingsImportSchema>;
export type SavingsImportProduct = z.infer<typeof importProductSchema>;

// ── Household bundle import ────────────────────────────────────────
// One file that loads everything: the Israeli PDF extract, manually-extracted
// accounts and benefits (US 401k / RSU / employer benefits), and profile
// members. Every part is optional; re-importing updates in place.

export const householdBundleSchema = z
  .object({
    israel: savingsImportSchema.optional(),
    accounts: z.array(createSavingsAccountSchema).max(200).optional(),
    benefits: z.array(createBenefitSchema).max(500).optional(),
    profile: updateProfileSchema.optional(),
  })
  .passthrough()
  .refine((b) => b.israel || b.accounts || b.benefits || b.profile, "Bundle is empty");
export type HouseholdBundle = z.infer<typeof householdBundleSchema>;

// ── Advisor ────────────────────────────────────────────────────────

export const advisorRequestSchema = z.object({ force: z.boolean().optional() });
