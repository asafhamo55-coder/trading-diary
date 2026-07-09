import { z } from "zod";

export const directionSchema = z.enum(["LONG", "SHORT"]);
export const legTypeSchema = z.enum(["BUY", "SELL"]);

export const tradeLegSchema = z.object({
  legType: legTypeSchema,
  price: z.number().positive("Price must be positive"),
  quantity: z.number().positive("Quantity must be positive"),
  legOrder: z.number().int().min(1).max(5),
});

export const createTradeSchema = z.object({
  tradeDate: z.string().transform((s) => new Date(s)),
  month: z.number().int().min(1).max(12),
  symbol: z.string().min(1, "Symbol is required").max(20),
  direction: directionSchema,
  tradeType: z.string().optional().nullable(),
  isSwingContinuation: z.boolean().default(false),
  isAsset: z.boolean().default(false),
  entries: z.array(tradeLegSchema).min(1, "At least one leg required"),
  entryReason: z.string().optional().nullable(),
  exitReason: z.string().optional().nullable(),
  conclusions: z.string().optional().nullable(),
  chartUrl: z.string().url().optional().nullable().or(z.literal("")),
  notes: z.string().optional().nullable(),
  dailyHigh: z.number().optional().nullable(),
  dailyClose: z.number().optional().nullable(),
  errorIds: z.array(z.string()).optional().default([]),
});

export const updateTradeSchema = createTradeSchema.partial();

export const monthlyReviewSchema = z.object({
  month: z.number().int().min(1).max(12),
  year: z.number().int().default(() => new Date().getFullYear()),
  portfolioStartValue: z.number().optional().nullable(),
  portfolioEndValue: z.number().optional().nullable(),
  riskUnit: z.number().optional().nullable(),
  goal1: z.string().optional().nullable(),
  goal2: z.string().optional().nullable(),
  goal3: z.string().optional().nullable(),
  goalsMet: z.string().optional().nullable(),
  monthlyConclusions: z.string().optional().nullable(),
  keyLessons: z.string().optional().nullable(),
  useFixedRiskUnit: z.boolean().default(false),
  includeOpenTrades: z.boolean().default(true),
});

export const accountSettingsSchema = z.object({
  calendarYear: z.number().int().optional(),
  startingBalance: z.number().positive().optional(),
  accountOpenBalance: z.number().positive().optional(),
  commissionPerShare: z.number().min(0).optional(),
  minimumCommission: z.number().min(0).optional(),
});

export const errorDefinitionSchema = z.object({
  name: z.string().min(1, "Error name is required"),
  sortOrder: z.number().int().default(0),
});

export const assetLeverageSchema = z.object({
  symbol: z.string().min(1, "Symbol is required"),
  leverage: z.number().positive("Leverage must be positive").default(1),
});

export const importTradeSchema = z.object({
  month: z.number().int().min(1).max(12),
  day: z.number().int().min(1).max(31),
  symbol: z.string().min(1),
  direction: directionSchema,
  tradeType: z.string().optional(),
  isSwingContinuation: z.boolean().optional().default(false),
  isAsset: z.boolean().optional().default(false),
  buyLegs: z.array(z.object({ price: z.number(), quantity: z.number() })),
  sellLegs: z.array(z.object({ price: z.number(), quantity: z.number() })),
  entryReason: z.string().optional(),
  exitReason: z.string().optional(),
  conclusions: z.string().optional(),
  chartUrl: z.string().optional(),
  errors: z.array(z.string()).optional(),
});

export const bulkImportSchema = z.object({
  trades: z.array(importTradeSchema),
  year: z.number().int().default(() => new Date().getFullYear()),
});

// ── Hamo Properties ────────────────────────────────────────────────

const propertyBaseSchema = z.object({
  // Structured address parts. The single-line `address` is composed from these
  // server-side; it may also be sent directly (e.g. by the importer).
  street: z.string().max(200).optional().nullable(),
  unit: z.string().max(40).optional().nullable(),
  city: z.string().max(120).optional().nullable(),
  state: z.string().max(60).optional().nullable(),
  zip: z.string().max(20).optional().nullable(),
  address: z.string().max(200).optional().nullable(),
  purchasePrice: z.number().nonnegative().optional().nullable(),
  purchaseDate: z
    .string()
    .optional()
    .nullable()
    .transform((s) => (s ? new Date(s) : null)),
  notes: z.string().max(1000).optional().nullable(),
});

export const createPropertySchema = propertyBaseSchema.refine(
  (d) => Boolean((d.street ?? "").trim() || (d.city ?? "").trim() || (d.address ?? "").trim()),
  { message: "Enter at least a street or city", path: ["street"] }
);

export const updatePropertySchema = propertyBaseSchema
  .partial()
  .extend({ archived: z.boolean().optional() });

export const propertyTxTypeSchema = z.enum(["INCOME", "EXPENSE"]);

export const createPropertyTransactionSchema = z.object({
  date: z.string().min(1, "Date is required"),
  type: propertyTxTypeSchema,
  category: z.string().min(1, "Category is required"),
  amount: z.number().positive("Amount must be positive"),
  description: z.string().max(300).optional().nullable(),
});

export const createTenantSchema = z.object({
  name: z.string().min(1, "Tenant name is required").max(120),
  email: z.string().email("Invalid email").optional().nullable().or(z.literal("")),
  phone: z.string().max(40).optional().nullable(),
  leaseStart: z.string().min(1, "Lease start date is required"),
  leaseEnd: z.string().optional().nullable(),
  monthlyRent: z.number().nonnegative().optional().nullable(),
  securityDeposit: z.number().nonnegative().optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
});

export const updateTenantSchema = createTenantSchema.partial();

export type CreatePropertyInput = z.infer<typeof createPropertySchema>;
export type CreatePropertyTransactionInput = z.infer<
  typeof createPropertyTransactionSchema
>;
export type CreateTenantInput = z.infer<typeof createTenantSchema>;

export type CreateTradeInput = z.infer<typeof createTradeSchema>;
export type UpdateTradeInput = z.infer<typeof updateTradeSchema>;
export type MonthlyReviewInput = z.infer<typeof monthlyReviewSchema>;
export type AccountSettingsInput = z.infer<typeof accountSettingsSchema>;
export type ErrorDefinitionInput = z.infer<typeof errorDefinitionSchema>;
export type AssetLeverageInput = z.infer<typeof assetLeverageSchema>;
export type ImportTradeInput = z.infer<typeof importTradeSchema>;
